-- Funny default bios — one per friend, explaining the placement.
-- Tone: lightly self-aware, mostly Swedish, no real biographical claims so
-- the user can edit them in admin mode without contradicting reality.
-- Idempotent: only fills empty bios so re-running leaves edits intact.

UPDATE friends SET bio =
  'Standardmått för all annan ranking. Om du undrar vad #1 ska kännas som — det är detta. Inga frågor, inga andrahandsåsikter.'
  WHERE id = 'mario' AND bio = '';

UPDATE friends SET bio =
  'Tystast i toppen, mest stabil. Vinner inga prisutdelningar men tappar aldrig en plats. Den ende man vågar lita på i en grupp-chatt.'
  WHERE id = 'adam' AND bio = '';

UPDATE friends SET bio =
  'Bor med Andre, vilket räknas som en lagsport. Halva poängen är därför outsourcad — de andra halv är pure Eliten.'
  WHERE id = 'emanuel' AND bio = '';

UPDATE friends SET bio =
  'Bor med Emanuel. De delar ranking, hyra och troligen handduk. Som listan står nu är de paketdeal.'
  WHERE id = 'andre' AND bio = '';

UPDATE friends SET bio =
  'G:et alla andra mäts mot. Skulle ranka högre om vi inte var lite rädda för att han läser detta.'
  WHERE id = 'gab' AND bio = '';

UPDATE friends SET bio =
  'Bekvämt #6. Kunde varit #5 om han hade synts lite mer 2026, men håll käften — det är ändå topp tier.'
  WHERE id = 'john' AND bio = '';

UPDATE friends SET bio =
  'Rankningen ligger mellan ”pålitlig” och ”helt okej”. Lever upp till båda, vilket är mer än vi kan säga om #11.'
  WHERE id = 'jacob' AND bio = '';

UPDATE friends SET bio =
  'Ibland ”Rob”, ibland ”Robin”, alltid längst åt nordöst. Hade rankats högre om vi orkat åka dit oftare.'
  WHERE id = 'robin' AND bio = '';

UPDATE friends SET bio =
  'Stabil A-tier. Inte hypad, inte hatad, alltid med på bilden. Den tysta krydan i Saltskog.'
  WHERE id = 'ninos' AND bio = '';

UPDATE friends SET bio =
  'Hänger ej med oss. Det räcker som motivering — kommittén har inget att tillägga.'
  WHERE id = 'joseph' AND bio = '';

UPDATE friends SET bio =
  'Plats #11 är ingen olycka — den är resultatet av en utvärdering. Vi fortsätter följa läget.'
  WHERE id = 'fredrik' AND bio = '';

UPDATE friends SET bio =
  'Steady. Vänlig, rolig, alltid där, men ändå mitt i I Dunno-tier. En av livets små mysterier.'
  WHERE id = 'ninmar' AND bio = '';

UPDATE friends SET bio =
  'Bor i Rönninge, vilket geografiskt diskvalificerar honom från finalen. Också svår att nå på text.'
  WHERE id = 'jovo' AND bio = '';

UPDATE friends SET bio =
  'Vet vad han gör 60 % av tiden. Resten är Christian-content som vi inte hinner förklara här.'
  WHERE id = 'christian' AND bio = '';

UPDATE friends SET bio =
  'Skulle nog blivit högre om listan var i en helt annan ordning. Tröstpris: bor närmast Christian.'
  WHERE id = 'joel' AND bio = '';

UPDATE friends SET bio =
  'Senaste tillskottet i listan. Kommittén är fortfarande osäker — därav placeringen. Vi återkommer.'
  WHERE id = 'george' AND bio = '';
