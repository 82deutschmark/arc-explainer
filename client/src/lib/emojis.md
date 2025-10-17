// ARC-aligned space emoji palette
// -------------------------------------------------------------
// Every list is exactly length-10, enabling a direct mapping of
// emoji index → ARC colour digit (0-9).  This avoids null cells
// in our grids: colour-0 (black or 'empty') is explicitly the first emoji, represented by '⬛'.
// 
// Official ARC Color Mapping (RGB values):
// 0: (0, 0, 0)        - Black (background)
// 1: (0, 116, 217)    - Blue  
// 2: (255, 65, 54)    - Red
// 3: (46, 204, 64)    - Green
// 4: (255, 220, 0)    - Yellow
// 5: (128, 128, 128)  - Grey
// 6: (240, 18, 190)   - Magenta/Pink
// 7: (255, 133, 27)   - Orange
// 8: (127, 219, 255)  - Light Blue/Cyan
// 9: (128, 0, 0)      - Maroon
// -------------------------------------------------------------
export const SPACE_EMOJIS = {

  // Celestial Bodies - Set 1 (Earth and celestial bodies)
  celestial_set1: ['⬛', '🌍', '🌎', '🌏', '⭐', '🌟', '✨', '💫', '🌠', '🪐'],

  // Celestial Bodies - Set 2 (Moon phases)
  celestial_set2: ['⬛', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘', '🌑', '🌒', '☀️', ],

  // Technology & Equipment - Set 1 (power and fuel)
  tech_set1: ['⬛', '⚡', '🔋', '🔌', '⛽', '☢️', '⚛️', '🔗', '⚙️', '🔧'],

  // Technology & Equipment - Set 2 (communication)
  tech_set2: ['⬛', '📡', '🛰️', '📱', '⌨️', '📶', '📋', '💻', '🎚️', '🎧'],

  // Navigation & Alerts (directional and compass) - Avoid using!!
  nav_alerts: ['⬛', '⬆️', '⬇️', '⬅️', '➡️', '↗️', '↖️', '↘️', '↙️', '🧭'],

  // Status & Alerts (warning and safety systems)
  status_alerts: ['⬛', '✅', '❌', '⚠️', '🚨', '🦺', '🔥', '❄️', '📍', '🎯'],

  // Weather & Climate (atmospheric conditions)
  weather_climate: ['⬛', '🌞', '🌪', '🌛', '🌜', '☁', '⛈️', '🌡', '🌤', '❄️'],

  // Status - Human Crew and Coworkers
  status_emojis: ['⬛', '😂', '😎', '🤪', '🙄', '😴', '😵', '🤗', '🤔', '😍'],

  // People - Human Crew and Coworkers 2
  people_emojis: ['⬛', '👩‍⚕️', '👨‍🔬', '👨‍🚒', '👷‍♂️', '👩‍🏫', '👮‍♂️', '👨‍💼', '👨‍🔧', '👩‍🏭'],

  // Status - AI and Computer Systems
  ai_emojis: ['⬛', '🤖', '💡', '🧠', '🔗', '⚙️', '🔧', '🔄', '⚡', '🚫'],

  // Vague Symbols - For the hardest tasks
  vague_symbols: ['⬛', '🕔', '💕', '💢', '🆎', '🆒', '🈚', '🛃', '💠', '☣'],

  // Alien Language - For the hardest tasks
  alien_language: ['⬛', '👽', '👤', '🪐', '🌍', '🛸', '☄️', '♥️', '⚠️', '🛰'],

  // Big & Wild Mammals
  big_mammals: ['⬛','🐯','🐑','🐺','🐗','🐴','🦄','🐐','🦌','🦁'], 

  // Reptiles & Amphibians
  reptiles_amphibians: ['⬛','🐢','🐍','🦎','🦖','🦕','🐊','🐸','🐌','🐲'],

  // Fruits (remaining)
  fruits_remaining: ['⬛','🍊','🍋','🍐','🍍','🥭','🥝','🥥','🍑','🍈'],

  // Sweets & Desserts
  sweets_desserts: ['⬛','🍰','🧁','🍪','🍩','🍫','🍬','🍭','🥧','🍯'],

  // Savory & Comfort Foods
  savory_foods: ['⬛','🍔','🍟','🌭','🍗','🍖','🥓','🍝','🍛','🍲'],

  // Games & Chance
  games_chance: ['⬛', '🎲', '🃏', '🀄', '🎴', '🕹️', '🎯', '🎰', '🏁', '🏆'],

  // Rare Plants & Nature
  rare_plants: ['⬛', '🍄', '🌵', '🌲', '🌴', '🎋', '🌱', '🍂', '🍁', '🌿'],

  // Alchemy & Science
  alchemy_science: ['⬛', '⚗️', '🔬', '🔭', '📡', '🧲', '🌡️', '🧬', '💉', '🧪'],

  // Ancient Scripts
  ancient_scripts: ['⬛', '𓀀', '𓂀', '𓃒', '𓆏', '𓋹', '𓍯', 'Ͽ', 'Ϡ', 'ͳ'],

  // Zodiac Signs
  zodiac_signs: ['⬛', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐'],

  // Foreign Celestial
  foreign_celestial: ['⬛', '🈶', '🈚', '🈯', '🈸', '🈴', '🈳', '㊗️', '㊙️', '🈺'],

  // Symbolic Portals & Gateways
  cosmic_portals: ['⬛', '🚪', '⛩️', '🏞️', '🛤️', '🌉', '🕳️', '🗺', '🔍', '🏛'],

  // Void Dwellers
  void_dwellers: ['⬛', '🐙', '🦑', '🦐', '🦀', '🐡', '🐠', '🐟', '🐬', '🐋'],

 // Birds 
    birds: ['⬛','🐤','🦜','🦩','🦚','🦢','🕊️','🦃','🐦','🐔'],

 // Medieval 
    medieval: ['⬛','🗡️','🛡️','🐎','👑','🏰','🏹','⚔️','📜','🗝'],

 // New sets September 14, 2025

// Insects & Small Creatures
insects_small: ['⬛', '🦗', '🐛', '🦋', '🐞', '🐝', '🐜', '🕷️', '🦟', '🦠'],

// Tools & Crafts  
tools_crafts: ['⬛', '🔨', '🪓', '🔩', '🧰', '📏', '📐', '✂️', '🖇️', '📎'],

// Musical Instruments
musical_instruments: ['⬛', '🎸', '🎹', '🥁', '🎺', '🎷', '🎻', '🪗', '🎤', '🎵'],

// Vegetables
vegetables: ['⬛', '🥕', '🥒', '🥬', '🥦', '🧄', '🧅', '🌶️', '🥔', '🍅'],

// Beverages & Drinks
beverages: ['⬛', '🍷', '🍾', '🥂', '🍻', '🍺', '☕', '💧', '🧃', '🥤'],

// Sports & Activities
sports_activities: ['⬛', '⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏓', '🏸', '🥊'],

// Transportation Vehicles
transportation: ['⬛', '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒'],

// Clothing & Accessories
clothing_accessories: ['⬛', '👕', '👔', '👗', '👠', '👟', '🧢', '🎩', '👒', '🧤'],

// Home & Furniture
home_furniture: ['⬛', '🏠', '🪑', '🛏️', '🚿', '🛁', '🎪', '🖼️', '🕯️', '🔦'],

// Geometric Shapes  - Very hard!
geometric_shapes: ['⬛', '⭕', '🟡', '🟠', '🔴', '🟢', '🔵', '🟣', '⚫', '⚪'],

  };


// Emoji set metadata for UI display
export const EMOJI_SET_INFO = {
  celestial_set1: {
    name: 'Planetary Bodies',
    description: 'Earth variants and lunar phases',
    theme: 'Celestial Navigation'
  },
  celestial_set2: {
    name: 'Stellar Objects',
    description: 'Stars, cosmic phenomena, and distant planets',
    theme: 'Deep Space'
  },
  tech_set1: {
    name: 'Power & Fuel Systems',
    description: 'Power & Fuel systems',
    theme: 'Power & Fuel'
  },
  tech_set2: {
    name: 'Communication Systems',
    description: 'Communication arrays and signal relays',
    theme: 'Communication'
  },
  nav_alerts: {
    name: 'Navigation Vectors',
    description: 'Directional indicators and compass systems',
    theme: 'Navigation'
  },
  status_alerts: {
    name: 'Alert Systems',
    description: 'Warnings, confirmations, and safety indicators',
    theme: 'Mission Safety'
  },
  weather_climate: {
    name: 'Atmospheric Data',
    description: 'Weather patterns and climate conditions',
    theme: 'Environmental'
  },
  status_emojis: {
    name: 'Human Crew and Coworkers',
    description: 'Human crew and coworkers',
    theme: 'Mission Safety'
  },
  people_emojis: {
    name: 'Human Crew and Coworkers',
    description: 'Human crew and coworkers',
    theme: 'Mission Safety'
  },
  ai_emojis: {
    name: 'AI and Computer Systems',
    description: 'AI and computer systems',
    theme: 'Mission Safety'
  },
  vague_symbols: {
    name: 'Vague Symbols',
    description: 'Vague symbols',
    theme: 'Officer Candidate'
  },
  alien_language: {
    name: 'Alien Language',
    description: 'Alien language',
    theme: 'Officer Candidate'
  },
  big_mammals: {
    name: 'Wild Mammals',
    description: 'Large mammals and wild creatures',
    theme: 'Natural World'
  },
  reptiles_amphibians: {
    name: 'Reptiles & Amphibians',
    description: 'Cold-blooded creatures and prehistoric life',
    theme: 'Natural World'
  },
  fruits_remaining: {
    name: 'Fresh Fruits',
    description: 'Tropical and citrus fruits collection',
    theme: 'Natural World'
  },
  sweets_desserts: {
    name: 'Sweets & Desserts',
    description: 'Cakes, candy, and sweet treats',
    theme: 'Food & Nutrition'
  },
  savory_foods: {
    name: 'Comfort Foods',
    description: 'Hearty meals and savory dishes',
    theme: 'Food & Nutrition'
  },
  games_chance: {
    name: 'Games & Chance',
    description: 'Gaming, luck, and competition symbols',
    theme: 'Entertainment'
  },
  rare_plants: {
    name: 'Rare Plants & Nature',
    description: 'Exotic plants and natural elements',
    theme: 'Natural World'
  },
  alchemy_science: {
    name: 'Alchemy & Science',
    description: 'Laboratory equipment, magic, and scientific instruments',
    theme: 'Science & Magic'
  },
  ancient_scripts: {
    name: 'Ancient Scripts',
    description: 'Egyptian hieroglyphs and ancient writing systems',
    theme: 'Ancient Languages'
  },
  zodiac_signs: {
    name: 'Zodiac Signs',
    description: 'Astrological symbols and celestial signs',
    theme: 'Astrology'
  },
  foreign_celestial: {
    name: 'Foreign Celestial',
    description: 'Eastern script symbols and celestial characters',
    theme: 'Foreign Scripts'
  },
  cosmic_portals: {
    name: 'Cosmic Portals',
    description: 'Gateways, voids, and dimensional passages',
    theme: 'Cosmic Mysteries'
  },
  void_dwellers: {
    name: 'Void Dwellers',
    description: 'Deep sea creatures and oceanic life forms',
    theme: 'Oceanic Depths'
  },
  birds: {
    name: 'Birds',
    description: 'Various bird species and poultry',
    theme: 'Natural World'
  },
  medieval: {
    name: 'Medieval',
    description: 'Various medieval symbols',
    theme: 'Medieval'
  },

// Add these to your EMOJI_SET_INFO object:

insects_small: {
  name: 'Insects & Small Creatures',
  description: 'Bugs, insects, and tiny creatures',
  theme: 'Natural World'
},
tools_crafts: {
  name: 'Tools & Crafts',
  description: 'Workshop tools and crafting equipment',
  theme: 'Workshop'
},
musical_instruments: {
  name: 'Musical Instruments',
  description: 'Various musical instruments and notes',
  theme: 'Entertainment'
},
vegetables: {
  name: 'Vegetables',
  description: 'Fresh vegetables and garden produce',
  theme: 'Food & Nutrition'
},
beverages: {
  name: 'Beverages & Drinks',
  description: 'Various drinks and beverages',
  theme: 'Food & Nutrition'
},
sports_activities: {
  name: 'Sports & Activities',
  description: 'Sports equipment and recreational activities',
  theme: 'Entertainment'
},
transportation: {
  name: 'Transportation Vehicles',
  description: 'Cars, trucks, and emergency vehicles',
  theme: 'Transportation'
},
clothing_accessories: {
  name: 'Clothing & Accessories',
  description: 'Garments, shoes, and fashion accessories',
  theme: 'Fashion'
},
home_furniture: {
  name: 'Home & Furniture',
  description: 'Household items and furniture',
  theme: 'Domestic Life'
},
geometric_shapes: {
  name: 'Geometric Shapes',
  description: 'Basic geometric forms and colors',
  theme: 'Abstract Geometry'
},

} as const;

export type EmojiSet = keyof typeof SPACE_EMOJIS;
export type SpaceEmoji = typeof SPACE_EMOJIS[EmojiSet][number];

// Dynamic dropdown generation - SINGLE SOURCE OF TRUTH
export interface EmojiSetOption {
  value: EmojiSet;
  label: string;
  icon: string;
}

/**
 * Gets a random emoji set for puzzle variety
 * @returns Random EmojiSet key
 */
export function getRandomEmojiSet(): EmojiSet {
  const emojiSetKeys = Object.keys(SPACE_EMOJIS) as EmojiSet[];
  const randomIndex = Math.floor(Math.random() * emojiSetKeys.length);
  return emojiSetKeys[randomIndex];
}

/**
 * Generate dropdown options dynamically from SPACE_EMOJIS and EMOJI_SET_INFO
 * This ensures new emoji sets automatically appear in all UI dropdowns
 */
export function getEmojiSetOptions(): EmojiSetOption[] {
  return Object.keys(SPACE_EMOJIS).map(setKey => {
    const emojiSet = setKey as EmojiSet;
    const emojis = SPACE_EMOJIS[emojiSet];
    const info = EMOJI_SET_INFO[emojiSet];
    
    return {
      value: emojiSet,
      label: info ? `${info.name}` : setKey,
      icon: emojis[1] // Use the second emoji (index 1) as icon, skip black square
    };
  });
}

/**
 * Get a formatted label for dropdown display with icon and name
 */
export function getEmojiSetDropdownLabel(emojiSet: EmojiSet): string {
  const emojis = SPACE_EMOJIS[emojiSet];
  const info = EMOJI_SET_INFO[emojiSet];
  const icon = emojis[1]; // Second emoji as icon
  const name = info ? info.name : emojiSet;
  return `${icon} ${name}`;
}

// Official ARC Color Constants (for when users switch to color display mode)
export const ARC_COLORS = {
  0: [0, 0, 0],        // Black (background)
  1: [0, 116, 217],    // Blue
  2: [255, 65, 54],    // Red
  3: [46, 204, 64],    // Green
  4: [255, 220, 0],    // Yellow
  5: [128, 128, 128],  // Grey
  6: [240, 18, 190],   // Magenta/Pink
  7: [255, 133, 27],   // Orange
  8: [127, 219, 255],  // Light Blue/Cyan
  9: [128, 0, 0],      // Maroon
} as const;

// Helper function to convert ARC color index to CSS RGB string
export const getARCColorCSS = (colorIndex: number): string => {
  const color = ARC_COLORS[colorIndex as keyof typeof ARC_COLORS];
  if (!color) return 'rgb(0, 0, 0)'; // Default to black
  return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
};

// Helper function to get ARC color as hex string
export const getARCColorHex = (colorIndex: number): string => {
  const color = ARC_COLORS[colorIndex as keyof typeof ARC_COLORS];
  if (!color) return '#000000'; // Default to black
  const [r, g, b] = color;
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};
