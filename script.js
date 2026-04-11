function toggleMenu() {
  document.getElementById("dropdownMenu").classList.toggle("show");
}

window.addEventListener("click", function(event) {
  const button = document.querySelector(".menu-button");
  const menu = document.getElementById("dropdownMenu");

  if (!button.contains(event.target) && !menu.contains(event.target)) {
    menu.classList.remove("show");
  }
});