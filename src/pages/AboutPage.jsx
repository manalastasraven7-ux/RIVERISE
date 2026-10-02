export default function AboutPage() {
  return (
    <section>
      <div className="section-header">
        <h2>About RIVERISE</h2>
      </div>
      <div className="panel">
        <p>
          RIVERISE helps communities monitor river conditions, detect rapid thresholds, and coordinate
          safer responses before flood impacts escalate.
        </p>
        <p className="muted">
          This application is designed to receive real readings from authenticated river sensors and to
          surface them clearly to residents and responders.
        </p>
      </div>
    </section>
  );
}
