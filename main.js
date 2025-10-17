document.addEventListener("DOMContentLoaded", () => {
    const buttons = document.querySelectorAll('[data-work-education-radio-button]');
    buttons.forEach(b => {
        b.addEventListener('click', () => {
            buttons.forEach(btn => {
               btn.setAttribute('data-selected', 'false'); 
            });
            b.setAttribute('data-selected', 'true');
            const slider = document.getElementById('experience-slider');
            if (b.getAttribute('data-value') == 'education') {
                slider.setAttribute('data-showing', 'education');
            } else {
                slider.setAttribute('data-showing', 'work');
            }
        });
    });
})
