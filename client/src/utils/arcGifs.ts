export const ARC_GIFS = [
  'arc_puzzle_0ca9ddb6_twinkle.gif',
  'arc_puzzle_1caeab9d_valign.gif',
  'arc_puzzle_1e32b0e9_mostest.gif',
  'arc_puzzle_1f0c79e5_sprout.gif',
  'arc_puzzle_007bbfb7_fractal.gif',
  'arc_puzzle_00d62c1b_honeypots.gif',
  'arc_puzzle_045e512c_stamp.gif',
  'arc_puzzle_05f2a901_magnets.gif',
  'arc_puzzle_08573cc6.gif',
  'arc_puzzle_0a938d79_columns.gif',
  'arc_puzzle_0ca9ddb6_twinkle.gif',
  'arc_puzzle_0dfd9992_cutouts.gif',
  'arc_puzzle_10fcaaa3_quadcopter.gif',
  'arc_puzzle_137eaa0f_shatter.gif',
  'arc_puzzle_1a07d186_cling.gif',
  'arc_puzzle_1c786137_crop.gif',
  'arc_puzzle_228f6490_putthemback.gif',
  'arc_puzzle_253bf280_lightsabers.gif',
  'arc_puzzle_25d487eb_laser.gif',
  'arc_puzzle_264363fd_flagmaker.gif',
  'arc_puzzle_28bf18c6_doublevision.gif',
  'arc_puzzle_28e73c20_spiral.gif',
  'arc_puzzle_3631a71a_kaleidoscope.gif',
  'arc_puzzle_39a8645d_maxconway.gif',
  'arc_puzzle_3f7978a0_glowsticks.gif',
  'arc_puzzle_4290ef0e_bullseye.gif',
  'arc_puzzle_46f33fce_waterbeads.gif',
  'arc_puzzle_484b58aa_cutouts3.gif',
  'arc_puzzle_50846271_underneath2.gif',
  'arc_puzzle_54d9e175_xmaslights.gif',
  'arc_puzzle_57aa92db_scaledregrow.gif',
  'arc_puzzle_5c2c9af4_radar.gif',
  'arc_puzzle_5daaa586_colorfall.gif',
  'arc_puzzle_6455b5f5_bisection.gif',
  'arc_puzzle_6aa20dc0_copyandzoom.gif',
  'arc_puzzle_6b9890af_conwaybox.gif',
  'arc_puzzle_6cf79266_bluesquare.gif',
  'arc_puzzle_6ecd11f4_hybridsprite.gif',
  'arc_puzzle_73251a56_cutouts4.gif',
  'arc_puzzle_776ffc46_matchbox.gif',
  'arc_puzzle_780d0b14_dirtyquilt.gif',
  'arc_puzzle_7837ac64_needlepoint.gif',
  'arc_puzzle_7df24a62_patternmatch.gif',
  'arc_puzzle_83302e8f_permeation.gif',
  'arc_puzzle_868de0fa_autumnboxes.gif',
  'arc_puzzle_8731374e_confettibox.gif',
  'arc_puzzle_8efcae92_mostpixels.gif',
  'arc_puzzle_90c28cc7_cleanquilt.gif',
  'arc_puzzle_97a05b5b_perfection.gif',
  'arc_puzzle_b527c5c6_lasereyes.gif',
  'arc_puzzle_db93a21d_deathstars.gif'
];

export function getRandomGif(seed: string | number): string {
  // Simple hash function to get deterministic GIF based on seed
  const str = String(seed);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  const index = Math.abs(hash) % ARC_GIFS.length;
  return `/images/decoration/${ARC_GIFS[index]}`;
}
