(function () {
  const body = document.documentElement;
  const toggle = document.getElementById('themeToggle');

  function setTheme(mode) {
    body.setAttribute('data-theme', mode);
    if (toggle) {
      const icon = toggle.querySelector('.av-theme-icon');
      if (icon) {
        icon.textContent = mode === 'dark' ? '🌙' : '☀️';
        icon.setAttribute('data-mode', mode);
      }
    }
    try {
      localStorage.setItem('av-theme', mode);
    } catch (_) {}
  }

  if (toggle) {
    const stored = (function () {
      try {
        return localStorage.getItem('av-theme');
      } catch (_) {
        return null;
      }
    })();
    if (stored === 'light' || stored === 'dark') setTheme(stored);

    toggle.addEventListener('click', () => {
      const current = body.getAttribute('data-theme') || 'dark';
      setTheme(current === 'dark' ? 'light' : 'dark');
    });
  }

  const searchInput = document.getElementById('globalSearch');
  const subjectFilter = document.getElementById('subjectFilter');
  const typeFilter = document.getElementById('typeFilter');

  async function fetchAssignments() {
    if (!searchInput && !subjectFilter && !typeFilter) return;
    const params = new URLSearchParams();
    if (searchInput && searchInput.value.trim()) params.set('q', searchInput.value.trim());
    if (subjectFilter && subjectFilter.value) params.set('subject', subjectFilter.value);
    if (typeFilter && typeFilter.value) params.set('type', typeFilter.value);

    try {
      const res = await fetch('/api/assignments?' + params.toString());
      if (!res.ok) return;
      const data = await res.json();
      filterCardsOnClient(data.assignments || []);
    } catch (e) {
      console.error('Search/filter failed', e);
    }
  }

  function filterCardsOnClient(assignments) {
    const map = new Map(assignments.map((a) => [a.id, true]));
    const cards = document.querySelectorAll('[data-id]');
    cards.forEach((card) => {
      const id = card.getAttribute('data-id');
      const show = map.has(id);
      card.style.display = show ? '' : 'none';
    });
  }

  if (searchInput) {
    let timer;
    searchInput.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(fetchAssignments, 220);
    });
  }
  if (subjectFilter) subjectFilter.addEventListener('change', fetchAssignments);
  if (typeFilter) typeFilter.addEventListener('change', fetchAssignments);

  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  if (dropzone && fileInput) {
    ['dragenter', 'dragover'].forEach((evt) => {
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('av-dropzone-active');
      });
    });
    ['dragleave', 'drop'].forEach((evt) => {
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('av-dropzone-active');
      });
    });
    dropzone.addEventListener('drop', (e) => {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        fileInput.files = e.dataTransfer.files;
      }
    });
  }

  let inactivityTimer;
  const INACTIVITY_LIMIT_MS = 30 * 60 * 1000;

  function resetInactivity() {
    if (!INACTIVITY_LIMIT_MS) return;
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = '/logout';
      document.body.appendChild(form);
      form.submit();
    }, INACTIVITY_LIMIT_MS);
  }

  ['click', 'keydown', 'mousemove', 'scroll'].forEach((evt) => {
    window.addEventListener(evt, resetInactivity);
  });
  resetInactivity();

  // Payment unlock flow on login page
  const paymentForm = document.getElementById('paymentLoginForm');
  const payButton = document.getElementById('payButton');
  const studentNameInput = document.getElementById('studentNameInput');
  const contactInput = document.getElementById('contactInput');
  const passcodeSection = document.getElementById('passcodeSection');
  const generatedPasscodeEl = document.getElementById('generatedPasscode');
  const passcodeStudentNameHidden = document.getElementById('passcodeStudentNameHidden');
  const loginPasscodeInput = document.getElementById('loginPasscodeInput');

  async function createOrder(payload) {
    const res = await fetch('/api/payment/order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Unable to start payment');
    }
    return res.json();
  }

  async function verifyPayment(details) {
    const res = await fetch('/api/payment/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(details),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Unable to verify payment');
    }
    return data;
  }

  if (paymentForm) {
    paymentForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (typeof Razorpay === 'undefined') {
        alert('Payment gateway is not loaded. Please check your Razorpay configuration.');
        return;
      }

      const studentName = studentNameInput ? studentNameInput.value.trim() : '';
      const contact = contactInput ? contactInput.value.trim() : '';

      if (!studentName) {
        alert('Please enter your name to continue.');
        return;
      }

      if (payButton) {
        payButton.disabled = true;
        payButton.textContent = 'Preparing payment...';
      }

      try {
        const orderData = await createOrder({ studentName, contact });

        const options = {
          key: orderData.keyId || window.AV_RAZORPAY_KEY_ID,
          amount: orderData.amount,
          currency: orderData.currency,
          name: 'Assignment Vault Access',
          description: 'One-time ₹5 unlock for assignments dashboard',
          order_id: orderData.orderId,
          prefill: {
            name: studentName,
            email: contact && contact.includes('@') ? contact : undefined,
            contact: contact && !contact.includes('@') ? contact : undefined,
          },
          theme: {
            color: '#4f46e5',
          },
          handler: async function (response) {
            try {
              const result = await verifyPayment({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              if (result && result.passcode) {
                if (generatedPasscodeEl) {
                  generatedPasscodeEl.textContent = result.passcode;
                }
                if (passcodeStudentNameHidden) {
                  passcodeStudentNameHidden.value = studentName;
                }
                if (passcodeSection) {
                  passcodeSection.style.display = '';
                }
                if (loginPasscodeInput) {
                  loginPasscodeInput.value = '';
                  loginPasscodeInput.focus();
                }
                alert('Your one-time passcode is: ' + result.passcode + '\nPlease enter it to complete login.');
              }
              if (payButton) {
                payButton.disabled = false;
                payButton.textContent = 'Pay ₹5 to Unlock';
              }
            } catch (err) {
              console.error(err);
              alert(err.message || 'Payment verification failed.');
              if (payButton) {
                payButton.disabled = false;
                payButton.textContent = 'Pay ₹5 to Unlock';
              }
            }
          },
          modal: {
            ondismiss: function () {
              if (payButton) {
                payButton.disabled = false;
                payButton.textContent = 'Pay ₹5 to Unlock';
              }
            },
          },
        };

        const rzp = new Razorpay(options);
        rzp.open();
      } catch (err) {
        console.error(err);
        alert(err.message || 'Unable to start payment.');
        if (payButton) {
          payButton.disabled = false;
          payButton.textContent = 'Pay ₹5 to Unlock';
        }
      }
    });
  }
})();
