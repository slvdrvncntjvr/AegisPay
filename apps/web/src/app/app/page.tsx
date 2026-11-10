import type { Metadata } from 'next';
import { ProductConsole } from '../../components/product/console';
import '../product.css';

export const metadata: Metadata = { title: 'AegisPay — Private Testnet console', robots: { index: false, follow: false } };

// Protected state is fetched only after hydration through the HttpOnly session.
// Neither a server component nor the public proof receives private data.
export default function AppPage() { return <ProductConsole />; }
