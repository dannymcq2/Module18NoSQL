function Portfolio() {
    const projects = [
      {
        title: "Project 1",
        image: "public/Screenshot 2024-09-25 at 6.43.04 PM.png",
        appLink: "https://dannymcq2.github.io/6weatherboard/",
        repoLink: "https://github.com/dannymcq2/6weatherboard",
      },
      {
        title: "Project 2",
        image: "public/Screenshot 2024-09-25 at 6.53.20 PM.png",
        appLink: "https://dannymcq2.github.io/module3employeedata/",
        repoLink: "https://github.com/dannymcq2/module3employeedata",
      },
      {
        title: "Project 3",
        image: "public/Screenshot 2024-09-25 at 6.55.21 PM.png",
        appLink: "https://dannymcq2.github.io/module4blogging/",
        repoLink: "https://github.com/dannymcq2/module4blogging",
      },
      {
        title: "Project 4",
        image: "public/Screenshot 2024-09-25 at 6.57.29 PM.png",
        appLink: "https://dannymcq2.github.io/module5tasks/",
        repoLink: "https://github.com/dannymcq2/module5tasks",
      },      {
        title: "Project 5",
        image: "public/Screenshot 2024-09-25 at 7.04.10 PM.png",
        appLink: "",
        repoLink: "https://github.com/mkeeney42/Film-Fanatics",
      },
      {
        title: "Project 6",
        image: "public/Screenshot 2024-09-25 at 7.04.10 PM.png",
        appLink: "",
        repoLink: "https://github.com/dannymcq2/notetakerx",
      },
    ];
  
    return (
      <section>
        <h2>Portfolio</h2>
        <div className="projects">
          {projects.map((project, index) => (
            <div key={index} className="project">
              <h3>{project.title}</h3>
              <img
  src={project.image}
  alt={`${project.title} screenshot`}
  style={{ width: '250px', height: '250px', borderRadius: '10px' }}  
/>
              <p>
                <a href={project.appLink} target="_blank" rel="noopener noreferrer">
                  View App
                </a>
                {' | '}
                <a href={project.repoLink} target="_blank" rel="noopener noreferrer">
                  GitHub Repo
                </a>
              </p>
            </div>
          ))}
        </div>
      </section>
    );
  }
  
  export default Portfolio;