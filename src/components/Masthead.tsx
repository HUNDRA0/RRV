import { useFriendsList } from '../lib/state';

const ISSUE_YEAR = new Date().getFullYear();

export function Masthead() {
  const { isAdmin } = useFriendsList();
  return (
    <div className="masthead">
      <div className="masthead-stamp">
        Vol. <strong>I</strong> · No. 1 / {ISSUE_YEAR}
      </div>
      <div className="issue-tag">⚡ The Official Annual Ranking · Issue No. 1 · {ISSUE_YEAR}</div>
      <div className="masthead-rule">
        <div className="rule-line" />
        <div className="rule-diamond" />
        <div className="rule-line r" />
      </div>
      <h1>
        Real Rankings <em>Viber</em>
      </h1>
      <p className="masthead-sub">Den officiella inrekretsens topp 16 — från eliten till tveksamt</p>
      {isAdmin && (
        <p className="admin-hint">
          ✏️ Klicka på foto för att byta · Klicka på namn/anteckning för att redigera
        </p>
      )}
    </div>
  );
}
