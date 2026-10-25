import type { Metadata } from 'next';
import { FittingRoom } from '@/components/boutique/FittingRoom';

export const metadata: Metadata = { title: 'Virtual Try-On' };

export default function FittingRoomPage() {
  return <FittingRoom />;
}
