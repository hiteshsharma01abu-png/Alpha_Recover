import { FeatureStrip } from '../components/ui/FeatureStrip';
import { IconCard } from '../components/ui/IconCard';
import { PageHero } from '../components/ui/PageHero';
import { heroArt, industriesPage } from '../data/pageContent';

export function Industries() {
  return (
    <div>
      <PageHero crumbs={[{ label: 'Industries' }]} title={industriesPage.title} sub={industriesPage.sub} art={heroArt.laptop} />
      <section className="section">
        <div className="container">
          <div className="ic-grid">
            {industriesPage.cards.map((card) => (
              <IconCard key={card.title} item={card} />
            ))}
          </div>
          <FeatureStrip items={industriesPage.features} />
        </div>
      </section>
    </div>
  );
}
