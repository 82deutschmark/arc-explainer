import subprocess
import threading
import time
import sys
import os

# List of games to play in the swarm
GAMES = [
    "as66", "ls20", "ft09", "lp85", "sp80", "vc33"
]

def run_agent_live(game_id):
    """Run the gold agent and stream output to log file."""
    log_file = f"logs/swarm_{game_id}.log"
    print(f"[{game_id}] Launching... Log: {log_file}")
    
    with open(log_file, "w", encoding="utf-8") as f:
        try:
            # Popen allows us to stream output
            process = subprocess.Popen(
                [sys.executable, "-u", "server/python/arc3_gold_agent.py", game_id],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1 # Line buffered
            )
            
            # Read line by line
            for line in process.stdout:
                f.write(line)
                f.flush() # Ensure it's written immediately
                
                # Simple status checking for console output
                if "Level" in line and "WIN" in line:
                    print(f"[{game_id}] \033[92m{line.strip()}\033[0m")
                elif "GAME_OVER" in line:
                    print(f"[{game_id}] \033[91mGAME OVER\033[0m")
            
            process.wait()
            
            if process.returncode != 0:
                 f.write(f"\n[SWARM] Process exited with code {process.returncode}\n")
                 
        except Exception as e:
            msg = f"\n[SWARM] Critical Error: {e}\n"
            f.write(msg)
            print(f"[{game_id}] ERROR: {e}")

def main():
    if not os.path.exists("logs"):
        os.makedirs("logs")

    print("===========================================")
    print("      LAUNCHING LIVE SWARM (6 GAMES)       ")
    print("===========================================")
    print("Output streaming to logs/swarm_*.log")
    
    threads = []
    
    for game in GAMES:
        t = threading.Thread(target=run_agent_live, args=(game,))
        threads.append(t)
        t.start()
        time.sleep(1) 
        
    for t in threads:
        t.join()
        
    print("\n===========================================")
    print("            SWARM RUN COMPLETE             ")
    print("===========================================")

if __name__ == "__main__":
    main()
