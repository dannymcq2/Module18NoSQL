
import React from 'react';

function Footer() {
  return (
    <footer style={footerStyle}>
      <p>&copy; {new Date().getFullYear()} Danny McHugh.</p>
      <ul style={socialLinksStyle}>
        <li>
          <a href="https://github.com/dannymcq2" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
        </li>
        <li>
          <a href="https://linkedin.com/in/na" target="_blank" rel="noopener noreferrer">
            LinkedIn
          </a>
        </li>
        <li>
          <a href="https://stackoverflow.com/users/na" target="_blank" rel="noopener noreferrer">
            Stack Overflow
          </a>
        </li>
        {}
      </ul>
    </footer>
  );
}

const footerStyle = {
    padding: "100px 300px", 
    backgroundColor: "#333",
    color: "#fff",
    textAlign: "center",
    left: "0",
    bottom: "0",
    width: "100%",
  };

const socialLinksStyle = {
  listStyle: "none",
  padding: 0,
  display: "flex",
  justifyContent: "center",
  gap: "5px",
};

export default Footer;