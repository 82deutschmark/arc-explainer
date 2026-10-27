#!/usr/bin/env python3.13
"""Author: GPT-6 / Codex
Date: 2026-10-27
PURPOSE: Refresh the public arcade's exact approved source/PNG snapshot from the existing lab feed.
SRP/DRY check: Pass — selection is entirely the lab's training_set; no votes or credentials here.
"""
import argparse
import concurrent.futures
import hashlib
import http.client
import json
import tempfile
from pathlib import Path
from urllib.parse import urlsplit


def fetch(origin, route):
    url = urlsplit(origin)
    if not route.startswith('/') or route.startswith('//'):
        raise ValueError('Expected a path on the lab origin')
    connection = http.client.HTTPSConnection(url.hostname, url.port or 443, timeout=45)
    try:
        connection.request('GET', route)
        response = connection.getresponse()
        if response.status != 200:
            raise RuntimeError(f'{route}: HTTP {response.status}')
        return response.read()
    finally:
        connection.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--api-url', default='https://arc3.sonpham.net')
    parser.add_argument('--out', type=Path, default=Path(__file__).resolve().parents[2] / 'server/data/arc3-trainable-games')
    args = parser.parse_args()
    manifest = json.loads(fetch(args.api_url, '/api/v1/public/games/trainable'))
    versions = manifest['versions']
    expected = hashlib.sha256(json.dumps(sorted([(v['versionId'], v['sha256']) for v in versions]), separators=(',', ':')).encode()).hexdigest()
    if manifest['count'] != len(versions) or manifest['snapshotId'] != expected:
        raise ValueError('Selection hash/count mismatch')
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=args.out.parent, prefix='.trainable-') as temp:
        staging = Path(temp)
        def save(v):
            game_id, sha = v['gameId'], v['sha256']
            prefix = f'/data/_games/{game_id}/{sha[:12]}/'
            if v['versionId'] != f'{game_id}@{sha[:12]}' or '/' in game_id or not v['sourceUrl'].startswith(prefix):
                raise ValueError('Unexpected version path')
            source = fetch(args.api_url, v['sourceUrl'])
            if hashlib.sha256(source).hexdigest() != sha:
                raise ValueError(f'{game_id}: source hash mismatch')
            if b'arcgames.bench' in source:
                raise ValueError(f'{game_id}: excluded parametric runtime')
            compile(source, v['srcFile'], 'exec')
            if v['thumbUrl'] != prefix + 'thumb.png':
                raise ValueError('Unexpected thumbnail path')
            png = fetch(args.api_url, v['thumbUrl'])
            if not png.startswith(bytes.fromhex('89504e470d0a1a0a')):
                raise ValueError(f'{game_id}: invalid PNG')
            stem = f'{game_id}-{sha[:12]}'
            (staging / f'{stem}.py').write_bytes(source)
            (staging / f'{stem}.png').write_bytes(png)
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            list(pool.map(save, versions))
        args.out.mkdir(parents=True, exist_ok=True)
        wanted = {p.name for p in staging.iterdir()}
        for p in staging.iterdir():
            p.replace(args.out / p.name)
        # Publish the manifest only once every approved source and recorded frame is present.
        (staging / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
        (staging / 'manifest.json').replace(args.out / 'manifest.json')
        for p in args.out.iterdir():
            if p.suffix in ('.py', '.png') and p.name not in wanted:
                p.unlink()
    print(f'Published snapshot: {len(versions)} approved games; SHA-256 {expected}')


if __name__ == '__main__':
    main()
