import { Providers } from './providers';

export default function App({ children }: { children: React.ReactNode }) {
  return <Providers>{children}</Providers>;
}
