import { Link } from 'react-router-dom';

export function NotepadLanding() {
  return (
    <main className="notepad-landing">
      <section className="hero">
        <p className="eyebrow">— THE NOTEPAD —</p>
        <h1>For what you cannot afford to forget.</h1>
        <p className="sub">
          The notepad that remembers what God has been saying — across your devotions, your sermons, the threads you've been walking with for months.
        </p>
        <Link to="/notepad/notes" className="cta-primary">
          Open your notepad →
        </Link>
      </section>
    </main>
  );
}
