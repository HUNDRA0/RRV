interface QuoteTickerProps {
  quote: string;
}

export function QuoteTicker({ quote }: QuoteTickerProps) {
  const date = new Date().toLocaleDateString('sv-SE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return (
    <div className="quote-ticker">
      <div className="quote-ticker-inner">
        <span className="quote-label">Dagens citat</span>
        <span className="quote-text">"{quote}"</span>
        <span className="quote-date">{date}</span>
      </div>
    </div>
  );
}

export const QUOTES_SEED = [
  "G's only.",
  'Tier är ett tillstånd, inte en plats.',
  'Den som scrollar lågt fastnar lågt.',
  'Vi rankar inte människor, vi rankar viben.',
  'Var en G, ranka som en G.',
  'Mariekällgatan never sleeps.',
  'Bangatan-bröder, alltid Bangatan-bröder.',
  'Drejarvägen är inte en plats, det är ett livsval.',
  'Det är inte en topplista, det är en spegel.',
  'Edit mode är livsstil.',
  'Ingen är G-less, vissa är bara längre bort.',
  'Du är så långt ner att GPS:en suckar.',
  'Eliten frukostar, resten lunchar.',
  "If your name's not in S-tier, that's your business.",
];
