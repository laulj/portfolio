const title = document.title;
let drpdown_profile = document.getElementById('profile');
let nav_link = 0;

switch (title) {
    case 'Overview':
        nav_link = document.getElementsByClassName("nav-overview");
        break;
    case 'Dashboard':
        nav_link = document.getElementsByClassName("nav-dashboard");
        break;
    case 'Login':
        nav_link = document.getElementsByClassName("nav-login");
        break;
    case 'Features':
        nav_link = document.getElementsByClassName("nav-features");
        break;
    case 'Profile':
        drpdown_profile.setAttribute("aria-current", "true");
        drpdown_profile.classList.add("active");
        break;
    default:
        drpdown_profile.setAttribute("aria-current", "false");
        drpdown_profile.classList.remove("active");
        nav_link = 0
        break;
}

if (nav_link != 0) {
    for (let nav of nav_link) {
        nav.classList.add('active');
    }
}
