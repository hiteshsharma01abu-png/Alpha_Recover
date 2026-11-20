import { FeatureStrip } from '../components/ui/FeatureStrip';
import { IconCard } from '../components/ui/IconCard';
import { PageHero } from '../components/ui/PageHero';
import { heroArt, servicesPage } from '../data/pageContent';

export function Services() {
  return (
    <div>
      <PageHero crumbs={[{ label: 'Services' }]} title={servicesPage.title} sub={servicesPage.sub} art={heroArt.hdd} />
      <section className="section">
        <div className="container">
          <div className="ic-grid">
            {servicesPage.cards.map((card) => (
              <IconCard key={card.title} item={card} />
            ))}
          </div>
          <FeatureStrip items={servicesPage.features} />
        </div>
      </section>
    </div>
  );
}
