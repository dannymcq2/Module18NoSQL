function Resume() {
  const proficiencies = [
    "HTML",
    "CSS",
    "JavaScript",
    "React",
    "Node.js",
    "Express",
    "MongoDB",
  ];

  return (
    <section>
      <h2>Resume</h2>
      <p>
        <a href="/path_to_your_resume.pdf" download="DannyMcHugh_Resume.pdf" aria-label="Download Danny McHugh's Resume">
          Download My Resume
        </a>
      </p>
      <h3>Proficiencies</h3>
      <ul>
        {proficiencies.map((skill, index) => (
          <li key={index}>{skill}</li>
        ))}
      </ul>
    </section>
  );
}

export default Resume;