import { Link } from 'react-router-dom'
import { openChat } from '../chatEvents'
import { ArrowRightIcon, PinIcon, ShieldIcon, SparkIcon } from '../components/Icons'

export default function About() {
  return (
    <>
      <section className="page-band tall">
        <div className="page-band-inner">
          <p className="eyebrow varsity">About us</p>
          <h1>A campus shop, rooted on Broadway.</h1>
          <p>Helping the Yale community show where they belong, one crewneck at a time.</p>
        </div>
      </section>

      <section className="section about">
        <div className="about-grid">
          <div className="about-story">
            <p className="lead">
              Campus Customs is a New Haven shop dedicated to one thing: helping the Yale community show where they
              belong.
            </p>
            <p>
              From our store on Broadway, a short walk from Old Campus, we carry officially licensed Yale clothing
              and gifts. First-years picking up their first hoodie, parents visiting for the weekend, alumni back for
              reunions, and fans heading to The Game all find something that feels like theirs.
            </p>
            <p>
              We organize our collection the way Yale is organized: by residential college, graduate and
              professional school, and athletic team. That makes it easy to find the crest or wordmark that means the
              most to you. Our range covers everyday tees and crewnecks, warm hoodies and quarter-zips, and jackets
              built for Connecticut winters.
            </p>
            <blockquote className="pull-quote">
              “Whether it's your first week on campus or your twenty-fifth reunion, it should feel like coming home.”
            </blockquote>
          </div>

          <aside className="about-card">
            <h3>Visit the shop</h3>
            <p className="about-address">
              <PinIcon size={20} />
              <span>
                57 Broadway
                <br />
                New Haven, Connecticut
              </span>
            </p>
            <p>A short walk from Old Campus. Or shop online, and ask our assistant for help with sizes and stock.</p>
            <Link to="/products" className="btn btn-primary">
              Shop online <ArrowRightIcon size={18} />
            </Link>
            <button className="btn btn-outline" onClick={() => openChat()}>
              Chat with our assistant
            </button>
          </aside>
        </div>

        <div className="values about-values">
          <div className="value">
            <ShieldIcon size={28} />
            <h3>Authentic</h3>
            <p>Officially licensed designs, done right.</p>
          </div>
          <div className="value">
            <PinIcon size={28} />
            <h3>Local</h3>
            <p>Rooted in New Haven, right next to campus.</p>
          </div>
          <div className="value">
            <SparkIcon size={28} />
            <h3>Community</h3>
            <p>For students, alumni, families, and fans.</p>
          </div>
        </div>
      </section>
    </>
  )
}
