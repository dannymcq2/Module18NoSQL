import { Link } from 'react-router-dom';

function Header() {
  return (
    <header className="header">
      <h1>Danny McHugh</h1>
      <nav>
        <ul className="nav-list">
          <li className="nav-item">
            <Link to="/">About Me</Link>
          </li>
          <li className="nav-item">
            <Link to="/portfolio">Portfolio</Link>
          </li>
          <li className="nav-item">
            <Link to="/contact">Contact</Link>
          </li>
          <li className="nav-item">
            <Link to="/resume">Resume</Link>
          </li>
          <li className="nav-item">
            <a href="#footer" aria-label="Go to Footer">Footer</a>
          </li>
        </ul>
      </nav>
    </header>
  );
}

export default Header;