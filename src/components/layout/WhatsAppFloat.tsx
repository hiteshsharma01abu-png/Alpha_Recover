import { company } from '../../data/content';
import { icons } from '../../lib/icons';
import './WhatsAppFloat.css';

export function WhatsAppFloat() {
  return (
    <a
      className="wa-float"
      href={company.whatsapp}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat with us on WhatsApp"
    >
      <span className="wa-float-copy">
        Need help? <strong>Chat with us</strong>
      </span>
      <span className="wa-float-icon" aria-hidden>
        <img src={icons.whatsappWhite} alt="" width={28} height={28} decoding="async" />
      </span>
    </a>
  );
}
