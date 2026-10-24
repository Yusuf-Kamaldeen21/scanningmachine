export interface CategorySuggestion {
  category: string;
  confidence: number;
  matchedKeyword?: string;
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Dairy Products': [
    'milk', 'evaporated milk', 'condensed milk', 'powdered milk', 'cheese', 'butter', 'yogurt',
    'yoghurt', 'peak', 'cowbell', 'dano', 'lano', 'hollandia', 'miksi', 'three crowns',
    'nunu', 'custard powder', 'creamer', 'dairy'
  ],
  'Beverages': [
    'tea', 'coffee', 'milo', 'bournvita', 'ovaltine', 'lipton', 'nescafe', 'juice', 'soda',
    'cola', 'pepsi', 'fanta', 'sprite', 'mirinda', 'seven up', 'maltina', 'amstel', 'malta guinness',
    'energy drink', 'red bull', 'fearless', 'climax', 'water', 'eva', 'nestle pure life',
    'cordial', 'ribena', 'lucozade', 'chivita', 'chi exotic', 'bobzi', 'smoothie', 'wine', 'beer'
  ],
  'Food & Groceries': [
    'rice', 'noodles', 'instant noodles', 'indomie', 'golden penny', 'chikki', 'spaghetti', 'pasta',
    'macaroni', 'flour', 'semovita', 'semo', 'wheat', 'garri', 'yam', 'oil', 'vegetable oil',
    'palm oil', 'olive oil', 'kings', 'mamador', 'power oil', 'gino', 'tomato paste', 'sachet tomato',
    'tin tomato', 'sonia', 'de rica', 'maggi', 'knorr', 'royco', 'curry', 'thyme', 'seasoning',
    'stock cube', 'salt', 'dangote', 'sugar', 'st. louis', 'beans', 'cornflakes', 'oats', 'quaker oats',
    'mayonnaise', 'ketchup', 'salad cream', 'bonga', 'crayfish', 'sardine', 'titus'
  ],
  'Snacks & Confectionery': [
    'biscuit', 'cookies', 'shortbread', 'crackers', 'digestive', 'oxford', 'beloxxi', 'wafers',
    'chin chin', 'chips', 'plantain chips', 'crisps', 'pringles', 'popcorn', 'candy', 'sweets',
    'chocolate', 'cadbury', 'mars', 'snickers', 'kitkat', 'mentos', 'chewing gum', 'orbit',
    'lollipop', 'gummy', 'cake', 'peanuts', 'cashew', 'burger peanut'
  ],
  'Hair Care': [
    'shampoo', 'conditioner', 'hair cream', 'hair oil', 'hair food', 'relaxer', 'dark and lovely',
    'mega growth', 'olive oil hair', 'hair spray', 'braid spray', 'styling gel', 'edge control',
    'hair dye', 'dandruff', 'hair treatment'
  ],
  'Skin Care': [
    'body lotion', 'body cream', 'moisturizer', 'vaseline', 'nivea', 'dove', 'fair and white',
    'carotone', 'pears baby', 'shea butter', 'glycerin', 'glycerine', 'body oil', 'cocoa butter',
    'sunscreen', 'cleanser', 'scrub', 'face cream', 'skin therapy'
  ],
  'Personal Care': [
    'deodorant', 'roll-on', 'body spray', 'perfume', 'bodyspray', 'axe', 'rexona', 'sure',
    'nivea men', 'shower gel', 'body wash', 'sanitary pad', 'always', 'molped', 'kotex',
    'tampon', 'panty liner', 'razor', 'shaving cream', 'gillette', 'cotton buds', 'cotton wool'
  ],
  'Toiletries': [
    'toilet paper', 'tissue', 'wipes', 'wet wipes', 'serviette', 'kitchen towel',
    'soap', 'bar soap', 'liquid soap', 'dettol', 'premier', 'lux', 'imperial leather',
    'sanitary', 'toothpaste', 'close up', 'colgate', 'oral-b', 'maclaens', 'sensodyne', 'toothbrush'
  ],
  'Household Cleaning': [
    'detergent', 'washing powder', 'ariel', 'omo', 'sunlight', 'so klin', 'klin', 'bleach',
    'hypo', 'javex', 'dishwashing liquid', 'morning fresh', 'mama lemon', 'fairy', 'disinfectant',
    'harpic', 'toilet cleaner', 'air freshener', 'glade', 'airfresh', 'insecticide', 'raid',
    'baygon', 'sniper', 'floor cleaner', 'mop', 'scouring pad', 'iron sponge'
  ],
  'Baby Products': [
    'diaper', 'pampers', 'molfix', 'huggies', 'baby food', 'cerelac', 'nan', 'sma gold',
    'infant formula', 'baby wipes', 'baby oil', 'baby lotion', 'baby powder', 'teether',
    'pacifier', 'feeding bottle'
  ],
  'Frozen Foods': [
    'frozen chicken', 'chicken wings', 'chicken thighs', 'turkey', 'frozen fish', 'titus frozen',
    'croaker', 'sausage', 'frankfurter', 'hot dog', 'ice cream', 'fan milk', 'fan dango', 'fan vanille'
  ],
  'Kitchen Supplies': [
    'aluminium foil', 'foil', 'cling film', 'baking paper', 'toothpick', 'plastic cup',
    'disposable plate', 'straw', 'matches', 'lighter', 'gas refill', 'sponge'
  ],
  'Stationery': [
    'pen', 'ballpoint', 'bic', 'pencil', 'notebook', 'exercise book', 'eraser', 'sharpener',
    'ruler', 'stapler', 'staples', 'glue', 'sticky notes', 'calculator', 'envelope', 'a4 paper'
  ],
};

/**
 * Suggests the best category based on brand, product name, and optional size/variant.
 */
export function suggestCategory(
  productName: string,
  brand: string,
  variant?: string
): CategorySuggestion | null {
  const combinedText = `${brand} ${productName} ${variant || ''}`.toLowerCase().trim();
  if (!combinedText) return null;

  let bestCategory = '';
  let highestScore = 0;
  let matchedKeyword = '';

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      const lowerKeyword = keyword.toLowerCase();
      // Exact word match has higher priority
      const regex = new RegExp(`\\b${lowerKeyword}\\b`, 'i');
      if (regex.test(combinedText)) {
        // Longer keywords indicate higher specificity
        const score = 10 + lowerKeyword.length;
        if (score > highestScore) {
          highestScore = score;
          bestCategory = category;
          matchedKeyword = keyword;
        }
      } else if (combinedText.includes(lowerKeyword)) {
        const score = 5 + lowerKeyword.length;
        if (score > highestScore) {
          highestScore = score;
          bestCategory = category;
          matchedKeyword = keyword;
        }
      }
    }
  }

  if (highestScore > 0 && bestCategory) {
    return {
      category: bestCategory,
      confidence: Math.min(100, Math.round((highestScore / 25) * 100)),
      matchedKeyword,
    };
  }

  return null;
}
