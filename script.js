document.addEventListener("DOMContentLoaded", () => {
    const menuToggle = document.querySelector(".menu-toggle");
    const nav = document.querySelector("nav ul");

    menuToggle.addEventListener("click", () => {
        nav.style.display = nav.style.display === "flex" ? "none" : "flex";
    });
});

const gridOverlay = document.querySelector(".grid-overlay");

document.addEventListener("mousemove", (e) => {
    const x = e.clientX;
    const y = e.clientY;

    // INVERT the mask so the grid is normally hidden and appears where the mouse is
    gridOverlay.style.maskImage = `radial-gradient(circle 120px at ${x}px ${y}px, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0) 100%)`;
    gridOverlay.style.webkitMaskImage = `radial-gradient(circle 120px at ${x}px ${y}px, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0) 100%)`;
});
