import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { scrollToPurposeGrid } from './two-path-interlude-actions';

export function TwoPathInterlude() {
  const sectionRef = useRef<HTMLElement>(null);

  const handleReadBelow = () => {
    scrollToPurposeGrid({
      findElementById: (id) => document.getElementById(id),
    });
  };

  return (
    <section
      ref={sectionRef}
      className="two-path-interlude"
      data-entered="false"
      aria-label="Continue"
    >
      <div className="two-path-hairline" aria-hidden="true" />

      <div className="two-path-col two-path-col-left">
        <p className="two-path-statement">
          Let's take a journey through God's word and find the peace that returns your joy. Let restoration guide you to serenity.
        </p>
        <button
          type="button"
          onClick={handleReadBelow}
          className="two-path-cta two-path-cta-read"
          aria-label="Read below — scroll to the purpose grid"
        >
          <span className="two-path-cta-label">Read Below</span>
          <span className="two-path-arrow" aria-hidden="true" />
        </button>
      </div>

      <div className="two-path-col two-path-col-right">
        <p className="two-path-statement">
          Take a moment to write about where you're at and see how God meets you there.
        </p>
        <Link
          to="/notepad"
          className="two-path-cta two-path-cta-notepad"
          aria-label="Go to Notepad"
        >
          <span className="two-path-cta-label">Go to Notepad</span>
          <span className="two-path-underline" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
