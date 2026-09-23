(() => {
  'use strict'

  // Fetch all the forms we want to apply custom Bootstrap validation styles to
  const forms = document.querySelectorAll('.needs-validation')

  Array.from(forms).forEach(form => {
    form.addEventListener('submit', event => {
      if (!form.checkValidity()) {
        event.preventDefault()
        event.stopPropagation()
        
        // Accessibility: Focus first invalid input
        const firstInvalid = form.querySelector(':invalid')
        if (firstInvalid) {
          firstInvalid.focus()
        }
      } else {
        // Prevent duplicate submissions and provide responsive UX feedback
        const submitBtn = form.querySelector('button[type="submit"]')
        if (submitBtn && !submitBtn.disabled) {
          const loadingText = submitBtn.getAttribute('data-submitting-text')
          if (loadingText) {
            submitBtn.disabled = true
            submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>${loadingText}`
          }
        }
      }

      form.classList.add('was-validated')
    }, false)
  })
})()