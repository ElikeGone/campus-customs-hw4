// Shop categories (these match the `category` values from /api/products).
export const SHOP_CATEGORIES = ['Hoodies', 'Crewnecks', 'T-shirts', 'Quarter-zips', 'Jackets & fleece', 'Long sleeve']

// A real catalogue product to picture each category on the Home page.
export const CATEGORY_IMAGES: Record<string, string> = {
  Hoodies: '/media/products/district-vit-hoodie-vintage-bulldog.jpg',
  Crewnecks: '/media/products/davenport-college-crewneck.jpg',
  'T-shirts': '/media/products/2025-yale-vs-harvard-t-shirt.jpg',
  'Quarter-zips': '/media/products/berkeley-1-4-zip.jpg',
  'Jackets & fleece': '/media/products/benjamin-franklin-fleece-jacket.jpg',
  'Long sleeve': '/media/products/dry-zone-long-sleeve.jpg',
}

export const categoryLink = (c: string) => `/products?category=${encodeURIComponent(c)}`
