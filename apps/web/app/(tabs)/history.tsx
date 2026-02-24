import { HistoryCard } from '@repo/ui/card';
import { ScreenContainer } from '@repo/ui/screen-container';

const mockHistory = [
  { id: '1', category: 'Top', size: 'M', fit: 87, date: '2026-02-20' },
  { id: '2', category: 'Dress', size: 'S', fit: 72, date: '2026-02-18' },
  { id: '3', category: 'Outerwear', size: 'L', fit: 95, date: '2026-02-15' },
];

export default function HistoryScreen() {
  return (
    <ScreenContainer title="History">
      {mockHistory.map((item) => (
        <HistoryCard
          key={item.id}
          title={`${item.category} Try-On`}
          category={item.category}
          size={item.size}
          fitProbability={item.fit}
          date={item.date}
        />
      ))}
    </ScreenContainer>
  );
}
