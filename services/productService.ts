import { Product } from '../types';

// Simulate a database of products
const MOCK_PRODUCTS: Product[] = [
  {
    id: 'p1',
    name: 'Nike Air Max 90',
    category: 'Shoes',
    price: '$120.00',
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=1000&auto=format&fit=crop'
  },
  {
    id: 'p2',
    name: 'Classic Leather Watch',
    category: 'Accessories',
    price: '$250.00',
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=1000&auto=format&fit=crop'
  },
  {
    id: 'p3',
    name: 'Modern Headphones',
    category: 'Electronics',
    price: '$300.00',
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=1000&auto=format&fit=crop'
  },
  {
    id: 'p4',
    name: 'Organic Skincare Set',
    category: 'Beauty',
    price: '$45.00',
    image: 'https://images.unsplash.com/photo-1556228720-1957be97984b?q=80&w=1000&auto=format&fit=crop'
  },
  {
    id: 'p5',
    name: 'Designer Sunglasses',
    category: 'Accessories',
    price: '$180.00',
    image: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?q=80&w=1000&auto=format&fit=crop'
  },
  {
    id: 'p6',
    name: 'Minimalist Chair',
    category: 'Home',
    price: '$450.00',
    image: 'https://images.unsplash.com/photo-1592078615290-033ee584e267?q=80&w=1000&auto=format&fit=crop'
  }
];

export const fetchProducts = async (): Promise<Product[]> => {
  // Simulate network latency
  await new Promise(resolve => setTimeout(resolve, 800));
  return MOCK_PRODUCTS;
};
