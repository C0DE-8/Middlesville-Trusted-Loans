(function ($) {
  "use strict";

  // toggle password
  $(".toggle-password").on("click", function () {
    $(this).toggleClass("fa-eye fa-eye-slash");
    var input = $(".login-page__password");
    if (input.attr("type") == "password") {
      input.attr("type", "text");
    } else {
      input.attr("type", "password");
    }
  });

  // loan calculator
  let loanForm = $(".loan-calculator-form");
  if (loanForm.length) {
    loanForm.each(function () {
      let form = $(this);
      let getID = form.attr("id");
      let loanMonthElm = form.find(".loan-month");
      let loanPayElm = form.find(".loan-monthly-pay");
      let loanTotalElm = form.find(".loan-total");
      let interestRate = form.data("interest-rate");
      let direction = form.data("form-direction");


      var monthRange = document.getElementById(getID + '-month');
      var countRange = document.getElementById(getID + '-count');

      var limitFieldMinMonth = document.getElementById(getID + '-min-month');
      var limitFieldMaxMonth = document.getElementById(getID + '-max-month');

      var limitFieldMinCount = document.getElementById(getID + '-min-count');
      var limitFieldMaxCount = document.getElementById(getID + '-max-count');

      noUiSlider.create(monthRange, {
        start: 6,
        behaviour: "snap",
        step: 1,
        tooltips: [
          wNumb({
            decimals: 0,
            suffix: " Month",
          }),
        ],
        connect: [true, false],
        range: {
          min: 1,
          max: 12,
        },
        direction: direction
      });

      noUiSlider.create(countRange, {
        start: 25000,
        step: 1000,
        tooltips: [
          wNumb({
            decimals: 0,
            prefix: "$",
          }),
        ],
        behaviour: "snap",
        connect: [true, false],
        range: {
          min: 1000,
          max: 50000,
        },
        direction: direction
      });

      monthRange.noUiSlider.on("update", function (values, handle) {
        (handle ? $(limitFieldMaxMonth) : $(limitFieldMinMonth)).attr("value", values[handle]);
        let loanMoney = limitFieldMinCount.value;
        let interestRatePercent = parseInt(interestRate, 10) / 100;
        let totalPay = loanMoney * interestRatePercent + parseInt(loanMoney, 10);
        let monthlyPay = totalPay / parseInt(values[handle], 10);

        loanMonthElm.html(parseInt(values[handle], 10));
        loanPayElm.html(formatNumberWithCommas(parseInt(monthlyPay, 10)));
        loanTotalElm.html(formatNumberWithCommas(parseInt(totalPay, 10)));
      });

      countRange.noUiSlider.on("update", function (values, handle) {
        (handle ? $(limitFieldMaxCount) : $(limitFieldMinCount)).attr("value", values[handle]);

        let loanMonth = limitFieldMinMonth.value;
        let interestRatePercent = parseInt(interestRate, 10) / 100;
        let totalPay = values[handle] * interestRatePercent + parseInt(values[handle], 10);
        let monthlyPay = totalPay / parseInt(loanMonth, 10);

        loanMonthElm.html(parseInt(loanMonth, 10));
        loanPayElm.html(formatNumberWithCommas(parseInt(monthlyPay, 10)));
        loanTotalElm.html(formatNumberWithCommas(parseInt(totalPay, 10)));
      });

      let loanMoney = limitFieldMinCount.value;
      let loanMonth = limitFieldMinMonth.value;
      let interestRatePercent = parseInt(interestRate, 10) / 100;
      let totalPay = loanMoney * interestRatePercent + parseInt(loanMoney, 10);
      let monthlyPay = totalPay / parseInt(loanMonth, 10);

      loanMonthElm.html(parseInt(loanMonth, 10));
      loanPayElm.html(formatNumberWithCommas(parseInt(monthlyPay, 10)));
      loanTotalElm.html(formatNumberWithCommas(parseInt(totalPay, 10)));
    });

  }

  const loanApplicationForm = document.getElementById("loan-application-form");
  if (loanApplicationForm) {
    initNumberOnlyInputs(loanApplicationForm);
    initCardExpirationInputs(loanApplicationForm);
    initIdUploadPreviews(loanApplicationForm);
    initAgentReferralCode(loanApplicationForm);

    let isLoanApplicationSubmitting = false;
    const loanApplicationSubmitButton = loanApplicationForm.querySelector("button[type='submit']");

    async function submitLoanApplication(event) {
      if (event) {
        event.preventDefault();
      }

      if (isLoanApplicationSubmitting) return;

      if (!loanApplicationForm.checkValidity()) {
        const message = document.getElementById("loan-application-message");
        if (message) {
          message.textContent = "Please complete all required fields before submitting.";
          message.classList.add("apply-loan__form__message--error");
        }
        loanApplicationForm.reportValidity();
        return;
      }

      const message = document.getElementById("loan-application-message");
      const submitButton = loanApplicationForm.querySelector("button[type='submit']");
      const submitButtonLabel = submitButton ? submitButton.querySelector("span:not(.form-loader)") : null;
      const originalButtonText = submitButtonLabel ? submitButtonLabel.textContent : "submit now";

      if (message) {
        message.textContent = "";
        message.innerHTML = "";
        message.classList.remove("apply-loan__form__message--error");
      }

      if (submitButton) {
        isLoanApplicationSubmitting = true;
        submitButton.disabled = true;
        submitButton.classList.add("is-loading");
        loanApplicationForm.classList.add("is-submitting");
        if (submitButtonLabel) {
          submitButtonLabel.textContent = "submitting";
        }
      }

      try {
        const formData = new FormData(loanApplicationForm);
        loanApplicationForm.querySelectorAll("[data-format-money]").forEach(function (input) {
          formData.set(input.name, stripNonDigits(input.value));
        });

        const data = await window.MTLApi.submitLoanApplication(formData);

        loanApplicationForm.reset();
        initAgentReferralCode(loanApplicationForm);
        clearIdUploadPreviews(loanApplicationForm);
        $(".selectpicker").selectpicker("refresh");

        if (message) {
          message.textContent = data.message || "Your loan application was submitted successfully.";
        }
      } catch (error) {
        if (message) {
          message.textContent = error.message;
          message.classList.add("apply-loan__form__message--error");
        }
      } finally {
        if (submitButton) {
          isLoanApplicationSubmitting = false;
          submitButton.disabled = false;
          submitButton.classList.remove("is-loading");
          loanApplicationForm.classList.remove("is-submitting");
          if (submitButtonLabel) {
            submitButtonLabel.textContent = originalButtonText.trim() || "submit now";
          }
        }
      }
    }

    loanApplicationForm.addEventListener("submit", submitLoanApplication);

    if (loanApplicationSubmitButton) {
      loanApplicationSubmitButton.addEventListener("click", submitLoanApplication);
    }
  }

  function initAgentReferralCode(form) {
    const input = form.querySelector("input[name='agent_referral_code']");
    if (!input) return;

    const params = new URLSearchParams(window.location.search);
    const referralCode = String(params.get("ref") || window.localStorage.getItem("mtl_agent_referral_code") || "")
      .trim()
      .toUpperCase();

    if (referralCode) {
      window.localStorage.setItem("mtl_agent_referral_code", referralCode);
      input.value = referralCode;
    }
  }

  document.addEventListener("input", function (event) {
    if (event.target && event.target.matches("[data-number-only]")) {
      formatNumberInput(event.target);
    }
    if (event.target && event.target.matches("[data-card-expiration]")) {
      formatCardExpirationInput(event.target);
    }
  });

  document.addEventListener("change", function (event) {
    if (event.target && event.target.matches("[data-number-only]")) {
      formatNumberInput(event.target);
    }
    if (event.target && event.target.matches("[data-card-expiration]")) {
      formatCardExpirationInput(event.target);
    }
  });

  function initNumberOnlyInputs(form) {
    const numberInputs = form.querySelectorAll("[data-number-only]");

    numberInputs.forEach(function (input) {
      input.addEventListener("input", function () {
        formatNumberInput(input);
      });
      input.addEventListener("blur", function () {
        formatNumberInput(input);
      });
      input.addEventListener("paste", function () {
        window.setTimeout(function () {
          formatNumberInput(input);
        }, 0);
      });
      formatNumberInput(input);
    });
  }

  function formatNumberInput(input) {
    const digits = stripNonDigits(input.value);
    input.value = input.hasAttribute("data-format-money") ? formatNumberWithCommas(digits) : digits;
  }

  function initCardExpirationInputs(form) {
    form.querySelectorAll("[data-card-expiration]").forEach(function (input) {
      input.addEventListener("blur", function () {
        formatCardExpirationInput(input);
      });
      formatCardExpirationInput(input);
    });
  }

  function formatCardExpirationInput(input) {
    const digits = stripNonDigits(input.value).slice(0, 4);
    input.value = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
  }

  function stripNonDigits(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function formatNumberWithCommas(value) {
    const digits = stripNonDigits(value);
    if (!digits) return "";

    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 0,
    }).format(Number(digits));
  }

  function initIdUploadPreviews(form) {
    const fileInputs = form.querySelectorAll("input[type='file'][data-preview-target]");

    fileInputs.forEach(function (input) {
      input.addEventListener("change", function () {
        renderIdUploadPreview(input);
      });
    });
  }

  function clearIdUploadPreviews(form) {
    form.querySelectorAll(".id-upload-preview").forEach(function (preview) {
      preview.innerHTML = "";
      preview.classList.remove("id-upload-preview--active");
    });
  }

  function renderIdUploadPreview(input) {
    const preview = document.getElementById(input.dataset.previewTarget);
    const file = input.files && input.files[0];
    if (!preview) return;

    preview.innerHTML = "";
    preview.classList.remove("id-upload-preview--active");

    if (!file) return;

    const meta = document.createElement("div");
    meta.className = "id-upload-preview__meta";

    const name = document.createElement("strong");
    name.textContent = file.name;

    const size = document.createElement("small");
    size.textContent = `${Math.max(file.size / 1024 / 1024, 0.01).toFixed(2)} MB`;

    meta.appendChild(name);
    meta.appendChild(size);

    if (file.type.startsWith("image/")) {
      const image = document.createElement("img");
      image.alt = "Selected ID preview";
      image.src = URL.createObjectURL(file);
      image.addEventListener("load", function () {
        URL.revokeObjectURL(image.src);
      });
      preview.appendChild(image);
    } else {
      const documentPreview = document.createElement("div");
      documentPreview.className = "id-upload-preview__file";
      documentPreview.textContent = "PDF";
      preview.appendChild(documentPreview);
    }

    preview.appendChild(meta);
    preview.classList.add("id-upload-preview--active");
  }

  const loanStatusForm = document.getElementById("loan-status-form");
  if (loanStatusForm) {
    loanStatusForm.addEventListener("submit", async function (event) {
      event.preventDefault();

      const message = document.getElementById("loan-status-message");
      const submitButton = loanStatusForm.querySelector("button[type='submit']");
      const submitButtonLabel = submitButton ? submitButton.querySelector("span:not(.form-loader)") : null;
      const originalButtonText = submitButtonLabel ? submitButtonLabel.textContent : "check status";
      const formData = new FormData(loanStatusForm);
      const email = formData.get("email");

      if (message) {
        message.textContent = "";
        message.innerHTML = "";
        message.classList.remove("apply-loan__form__message--error");
        message.classList.remove("loan-status-result");
      }

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.classList.add("is-loading");
        if (submitButtonLabel) {
          submitButtonLabel.textContent = "checking";
        }
      }

      try {
        const data = await window.MTLApi.checkLoanStatus(email);
        const application = data.application;

        if (message) {
          renderLoanStatusResult(message, application, data.emailSent || data.emailQueued);
        }
      } catch (error) {
        if (message) {
          message.textContent = error.message;
          message.classList.add("apply-loan__form__message--error");
        }
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.classList.remove("is-loading");
          if (submitButtonLabel) {
            submitButtonLabel.textContent = originalButtonText.trim() || "check status";
          }
        }
      }
    });
  }

  function renderLoanStatusResult(container, application, emailSent) {
    const submittedDate = new Date(application.created_at).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const statusLabel = String(application.status || "pending").replace(/^\w/, function (letter) {
      return letter.toUpperCase();
    });

    container.classList.add("loan-status-result");
    container.innerHTML = "";

    const header = document.createElement("div");
    header.className = "loan-status-result__header";

    const badge = document.createElement("span");
    badge.className = "loan-status-result__badge";
    badge.textContent = statusLabel;

    const applicant = document.createElement("strong");
    applicant.textContent = application.full_name || "Application";

    const grid = document.createElement("div");
    grid.className = "loan-status-result__grid";

    [
      ["Loan Type", application.loan_purpose],
      ["Amount", formatNumberWithCommas(application.loan_amount)],
      ["Term", application.loan_years],
      ["Submitted", submittedDate],
    ].forEach(function (item) {
      const field = document.createElement("span");
      const label = document.createElement("small");
      label.textContent = item[0];
      field.appendChild(label);
      field.appendChild(document.createTextNode(item[1] || "Not available"));
      grid.appendChild(field);
    });

    header.appendChild(badge);
    header.appendChild(applicant);
    container.appendChild(header);
    container.appendChild(grid);

    if (emailSent) {
      const notice = document.createElement("p");
      notice.className = "loan-status-result__notice";
      notice.textContent = "A status email is being sent to the address on this application.";
      container.appendChild(notice);
    }
  }

  let loanRange = $('.loan-range');
  if (loanRange.length) {
    loanRange.each(function () {
      let elm = $(this);
      let options = elm.data("range-options");
      let optionsJson = "object" === typeof options ? options : JSON.parse(options);
      noUiSlider.create(elm[0], {
        start: optionsJson.start,
        behaviour: "snap",
        step: 1,
        tooltips: [
          wNumb({
            decimals: 0,
            suffix: optionsJson.suffix,
          }),
        ],
        connect: [true, false],
        range: {
          min: optionsJson.range.min,
          max: optionsJson.range.max,
        },
      })
    });
  }

  /*-- Checkout Accoradin --*/
  if ($(".checkout-page__payment__title").length) {
    $(".checkout-page__payment__item")
      .find(".checkout-page__payment__content")
      .hide();
    $(".checkout-page__payment__item--active")
      .find(".checkout-page__payment__content")
      .show();
    $(".checkout-page__payment__title").on("click", function (e) {
      e.preventDefault();
      $(this)
        .parents(".checkout-page__payment")
        .find(".checkout-page__payment__item")
        .removeClass("checkout-page__payment__item--active");
      $(this)
        .parents(".checkout-page__payment")
        .find(".checkout-page__payment__content")
        .slideUp();
      $(this).parent().addClass("checkout-page__payment__item--active");
      $(this).parent().find(".checkout-page__payment__content").slideDown();
    });
  }

  let dynamicyearElm = $(".dynamic-year");
  if (dynamicyearElm.length) {
    let currentYear = new Date().getFullYear();
    dynamicyearElm.html(currentYear);
  }

  // Date Picker
  if ($(".easilon-datepicker").length) {
    $(".easilon-datepicker").each(function () {
      $(this).datepicker();
    });
  }

  // Popular Causes Progress Bar
  if ($(".count-bar").length) {
    $(".count-bar").appear(
      function () {
        var el = $(this);
        var percent = el.data("percent");
        $(el).css("width", percent).addClass("counted");
      }, {
        accY: -50
      }
    );
  }

  //Fact Counter + Text Count
  if ($(".count-box").length) {
    $(".count-box").appear(
      function () {
        var $t = $(this),
          n = $t.find(".count-text").attr("data-stop"),
          r = parseInt($t.find(".count-text").attr("data-speed"), 10);

        if (!$t.hasClass("counted")) {
          $t.addClass("counted");
          $({
            countNum: $t.find(".count-text").text()
          }).animate({
            countNum: n
          }, {
            duration: r,
            easing: "linear",
            step: function () {
              $t.find(".count-text").text(Math.floor(this.countNum));
            },
            complete: function () {
              $t.find(".count-text").text(this.countNum);
            }
          });
        }
      }, {
        accY: 0
      }
    );
  }

  // custom coursor
  if ($(".custom-cursor").length) {
    var cursor = document.querySelector(".custom-cursor__cursor");
    var cursorinner = document.querySelector(".custom-cursor__cursor-two");
    var a = document.querySelectorAll("a");

    document.addEventListener("mousemove", function (e) {
      var x = e.clientX;
      var y = e.clientY;
      cursor.style.transform = `translate3d(calc(${e.clientX}px - 50%), calc(${e.clientY}px - 50%), 0)`;
    });

    document.addEventListener("mousemove", function (e) {
      var x = e.clientX;
      var y = e.clientY;
      cursorinner.style.left = x + "px";
      cursorinner.style.top = y + "px";
    });

    document.addEventListener("mousedown", function () {
      cursor.classList.add("click");
      cursorinner.classList.add("custom-cursor__innerhover");
    });

    document.addEventListener("mouseup", function () {
      cursor.classList.remove("click");
      cursorinner.classList.remove("custom-cursor__innerhover");
    });

    a.forEach((item) => {
      item.addEventListener("mouseover", () => {
        cursor.classList.add("custom-cursor__hover");
      });
      item.addEventListener("mouseleave", () => {
        cursor.classList.remove("custom-cursor__hover");
      });
    });
  }

  if ($(".contact-form-validated").length) {
    $(".contact-form-validated").validate({
      // initialize the plugin
      rules: {
        name: {
          required: true
        },
        email: {
          required: true,
          email: true
        },
        phone: {
          required: true
        },
        message: {
          required: true
        },
        subject: {
          required: true
        }
      },
      submitHandler: function (form) {
        var $form = $(form);
        var $result = $form.parent().find(".result");
        var formData = new FormData(form);
        var payload = {};

        formData.forEach(function (value, key) {
          payload[key] = value;
        });

        if (!payload.subject) {
          payload.subject = $form.find("select option:selected").text() || "Website message";
        }

        window.MTLApi.submitContactMessage(payload)
          .then(function (response) {
            $result.html('<p class="mc-message">' + (response.message || "Your message was sent successfully.") + "</p>");
            $form.find('input[type="text"]').val("");
            $form.find('input[type="email"]').val("");
            $form.find('input[type="tel"]').val("");
            $form.find("textarea").val("");
          })
          .catch(function (error) {
            $result.html('<p class="mc-message">' + error.message + "</p>");
          });
        return false;
      }
    });
  }

  // newsletter form
  if ($(".mc-form").length) {
    $(".mc-form").each(function () {
      var Self = $(this);
      var mcResp = Self.parent().find(".mc-form__response");

      Self.on("submit", function (event) {
        event.preventDefault();

        var email = Self.find('input[name="EMAIL"], input[name="email"]').val();
        mcResp.removeClass("errored successed").html("");

        window.MTLApi.submitNewsletter(email)
          .then(function (response) {
            Self.removeClass("errored").addClass("successed");
            mcResp.removeClass("errored").addClass("successed");
            mcResp.html('<p class="mc-message">' + (response.message || "Thank you for subscribing.") + "</p>");
            Self.find("input").val("");
            mcResp.find("p").fadeOut(10000);
          })
          .catch(function (error) {
            Self.removeClass("successed").addClass("errored");
            mcResp.removeClass("successed").addClass("errored");
            mcResp.html('<p class="mc-message">' + error.message + "</p>");
            mcResp.find("p").fadeOut(10000);
          });
      });
    });
  }

  if ($(".video-popup").length) {
    $(".video-popup").magnificPopup({
      type: "iframe",
      mainClass: "mfp-fade",
      removalDelay: 160,
      preloader: true,

      fixedContentPos: false
    });
  }

  if ($(".img-popup").length) {
    var groups = {};
    $(".img-popup").each(function () {
      var id = parseInt($(this).attr("data-group"), 10);

      if (!groups[id]) {
        groups[id] = [];
      }

      groups[id].push(this);
    });

    $.each(groups, function () {
      $(this).magnificPopup({
        type: "image",
        closeOnContentClick: true,
        closeBtnInside: false,
        gallery: {
          enabled: true
        }
      });
    });
  }

  function dynamicCurrentMenuClass(selector) {
    let FileName = window.location.href.split("/").reverse()[0];

    selector.find("li").each(function () {
      let anchor = $(this).find("a");
      if ($(anchor).attr("href") == FileName) {
        $(this).addClass("current");
      }
    });
    // if any li has .current elmnt add class
    selector.find("li").each(function () {
      if ($(this).find(".current").length) {
        $(this).addClass("current");
      }
    });
    // if no file name return
    if ("" == FileName) {
      selector.find("li").eq(0).addClass("current");
    }
  }

  if ($(".main-menu__list").length) {
    // dynamic current class
    let mainNavUL = $(".main-menu__list");
    dynamicCurrentMenuClass(mainNavUL);
  }

  if ($(".service-sidebar__nav").length) {
    // dynamic current class
    let mainNavUL = $(".service-sidebar__nav");
    dynamicCurrentMenuClass(mainNavUL);
  }

  if ($(".main-menu").length && $(".mobile-nav__container").length) {
    let navContent = document.querySelector(".main-menu").innerHTML;
    let mobileNavContainer = document.querySelector(".mobile-nav__container");
    mobileNavContainer.innerHTML = navContent;
  }

  if ($(".sticky-header").length) {
    $(".sticky-header")
      .clone()
      .insertAfter(".sticky-header")
      .addClass("sticky-header--cloned");
  }

  if ($(".mobile-nav__container .main-menu__list").length) {
    let dropdownAnchor = $(
      ".mobile-nav__container .main-menu__list .dropdown > a"
    );
    dropdownAnchor.each(function () {
      let self = $(this);
      let toggleBtn = document.createElement("BUTTON");
      toggleBtn.setAttribute("aria-label", "dropdown toggler");
      toggleBtn.innerHTML = "<i class='fa fa-angle-down'></i>";
      self.append(function () {
        return toggleBtn;
      });
      self.find("button").on("click", function (e) {
        e.preventDefault();
        let self = $(this);
        self.toggleClass("expanded");
        self.parent().toggleClass("expanded");
        self.parent().parent().children("ul").slideToggle();
      });
    });
  }

  //Show Popup menu
  $(document).on("click", ".megamenu-clickable--toggler > a", function (e) {
    $("body").toggleClass("megamenu-popup-active");
    $(this).parent().find("ul").toggleClass("megamenu-clickable--active");
    e.preventDefault();
  });
  $(document).on("click", ".megamenu-clickable--close", function (e) {
    $("body").removeClass("megamenu-popup-active");
    $(".megamenu-clickable--active").removeClass("megamenu-clickable--active");
    e.preventDefault();
  });

  if ($(".mobile-nav__toggler").length) {
    $(".mobile-nav__toggler").on("click", function (e) {
      e.preventDefault();
      $(".mobile-nav__wrapper").toggleClass("expanded");
      $("body").toggleClass("locked");
    });
  }

  // Sidebar
  if ($(".sidebar-btn__toggler").length) {
    $(".sidebar-btn__toggler").on("click", function (e) {
      e.preventDefault();
      $(".sidebar-one").toggleClass("active");
      $("body").toggleClass("locked");
    });
  }

  if ($(".search-toggler").length) {
    $(".search-toggler").on("click", function (e) {
      e.preventDefault();
      $(".search-popup").toggleClass("active");
      $(".mobile-nav__wrapper").removeClass("expanded");
      $("body").toggleClass("locked");
    });
  }
  if ($(".mini-cart__toggler").length) {
    $(".mini-cart__toggler").on("click", function (e) {
      e.preventDefault();
      $(".mini-cart").toggleClass("expanded");
      $(".mobile-nav__wrapper").removeClass("expanded");
      $("body").toggleClass("locked");
    });
  }
  if ($(".odometer").length) {
    $(".odometer").appear(function (e) {
      var odo = $(".odometer");
      odo.each(function () {
        var countNumber = $(this).attr("data-count");
        $(this).html(countNumber);
      });
    });
  }

  if ($(".wow").length) {
    var wow = new WOW({
      boxClass: "wow", // animated element css class (default is wow)
      animateClass: "animated", // animation css class (default is animated)
      mobile: true, // trigger animations on mobile devices (default is true)
      live: true // act on asynchronously loaded content (default is true)
    });
    wow.init();
  }

  if ($("#donate-amount__predefined").length) {
    let donateInput = $("#donate-amount");
    $("#donate-amount__predefined")
      .find("li")
      .on("click", function (e) {
        e.preventDefault();
        let amount = $(this).find("a").text();
        donateInput.val(amount);
        $("#donate-amount__predefined").find("li").removeClass("active");
        $(this).addClass("active");
      });
  }

  //accordion
  if ($(".easilon-accordion").length) {
    var accordionGrp = $(".easilon-accordion");
    accordionGrp.each(function () {
      var accordionName = $(this).data("grp-name");
      var Self = $(this);
      var accordion = Self.find(".accordion");
      Self.addClass(accordionName);
      Self.find(".accordion .accordion-content").hide();
      Self.find(".accordion.active").find(".accordion-content").show();
      accordion.each(function () {
        $(this)
          .find(".accordion-title")
          .on("click", function () {
            if ($(this).parent().hasClass("active") === false) {
              $(".easilon-accordion." + accordionName)
                .find(".accordion")
                .removeClass("active");
              $(".easilon-accordion." + accordionName)
                .find(".accordion")
                .find(".accordion-content")
                .slideUp();
              $(this).parent().addClass("active");
              $(this).parent().find(".accordion-content").slideDown();
            }
          });
      });
    });
  }

  $(".add").on("click", function () {
    if ($(this).prev().val() < 999) {
      $(this)
        .prev()
        .val(+$(this).prev().val() + 1);
    }
  });

  $(".sub").on("click", function () {
    if ($(this).next().val() > 0) {
      if ($(this).next().val() > 0)
        $(this)
        .next()
        .val(+$(this).next().val() - 1);
    }
  });

  if ($(".tabs-box").length) {
    $(".tabs-box .tab-buttons .tab-btn").on("click", function (e) {
      e.preventDefault();
      var target = $($(this).attr("data-tab"));

      if ($(target).is(":visible")) {
        return false;
      } else {
        target
          .parents(".tabs-box")
          .find(".tab-buttons")
          .find(".tab-btn")
          .removeClass("active-btn");
        $(this).addClass("active-btn");
        target
          .parents(".tabs-box")
          .find(".tabs-content")
          .find(".tab")
          .fadeOut(0);
        target
          .parents(".tabs-box")
          .find(".tabs-content")
          .find(".tab")
          .removeClass("active-tab");
        $(target).fadeIn(300);
        $(target).addClass("active-tab");
      }
    });
  }

  if ($(".range-slider-price").length) {
    var priceRange = document.getElementById("range-slider-price");

    noUiSlider.create(priceRange, {
      start: [30, 150],
      limit: 200,
      behaviour: "drag",
      connect: true,
      range: {
        min: 10,
        max: 200
      }
    });

    var limitFieldMin = document.getElementById("min-value-rangeslider");
    var limitFieldMax = document.getElementById("max-value-rangeslider");

    priceRange.noUiSlider.on("update", function (values, handle) {
      (handle ? $(limitFieldMax) : $(limitFieldMin)).text(values[handle]);
    });
  }

  function thmOwlInit() {
    // owl slider
    let easilonowlCarousel = $(".easilon-owl__carousel");
    if (easilonowlCarousel.length) {
      easilonowlCarousel.each(function () {
        let elm = $(this);
        let options = elm.data("owl-options");
        let thmOwlCarousel = elm.owlCarousel(
          "object" === typeof options ? options : JSON.parse(options)
        );
        elm.find("button").each(function () {
          $(this).attr("aria-label", "carousel button");
        });
      });
    }
    let easilonowlCarouselNav = $(".easilon-owl__carousel--custom-nav");
    if (easilonowlCarouselNav.length) {
      easilonowlCarouselNav.each(function () {
        let elm = $(this);
        let owlNavPrev = elm.data("owl-nav-prev");
        let owlNavNext = elm.data("owl-nav-next");
        $(owlNavPrev).on("click", function (e) {
          elm.trigger("prev.owl.carousel");
          e.preventDefault();
        });

        $(owlNavNext).on("click", function (e) {
          elm.trigger("next.owl.carousel");
          e.preventDefault();
        });
      });
    }
  }

  function thmTinyInit() {
    // tiny slider
    const tinyElm = document.querySelectorAll(".thm-tiny__slider");
    tinyElm.forEach(function (tinyElm) {
      const tinyOptions = JSON.parse(tinyElm.dataset.tinyOptions);
      let thmTinySlider = tns(tinyOptions);
    });
  }

  function easilonSlickInit() {
    // slick slider
    let easilonslickCarousel = $(".easilon-slick__carousel");
    if (easilonslickCarousel.length) {
      easilonslickCarousel.each(function () {
        let elm = $(this);
        let options = elm.data("slick-options");
        let easilonslickCarousel = elm.slick(
          "object" === typeof options ? options : JSON.parse(options)
        );
      });
    }
  }

  /*-- Handle Scrollbar --*/
  function handleScrollbar() {
    const bodyHeight = $("body").height();
    const scrollPos = $(window).innerHeight() + $(window).scrollTop();
    let percentage = (scrollPos / bodyHeight) * 100;
    if (percentage > 100) {
      percentage = 100;
    }
    $(".scroll-to-top .scroll-to-top__inner").css("width", percentage + "%");
  }

  /*-- One Page Menu --*/
  function SmoothMenuScroll() {
    var anchor = $(".scrollToLink");
    if (anchor.length) {
      anchor.children("a").bind("click", function (event) {
        if ($(window).scrollTop() > 10) {
          var headerH = "0";
        } else {
          var headerH = "0";
        }
        var target = $(this);
        $("html, body")
          .stop()
          .animate({
              scrollTop: $(target.attr("href")).offset().top - headerH + "px"
            },
            900,
            "easeInOutExpo"
          );
        anchor.removeClass("current");
        anchor.removeClass("current-menu-ancestor");
        anchor.removeClass("current_page_item");
        anchor.removeClass("current-menu-parent");
        target.parent().addClass("current");
        event.preventDefault();
      });
    }
  }
  SmoothMenuScroll();

  function OnePageMenuScroll() {
    var windscroll = $(window).scrollTop();
    if (windscroll >= 117) {
      var menuAnchor = $(".one-page-scroll-menu .scrollToLink").children("a");
      menuAnchor.each(function () {
        var sections = $(this).attr("href");
        $(sections).each(function () {
          if ($(this).offset().top <= windscroll + 100) {
            var Sectionid = $(sections).attr("id");
            $(".one-page-scroll-menu").find("li").removeClass("current");
            $(".one-page-scroll-menu")
              .find("li")
              .removeClass("current-menu-ancestor");
            $(".one-page-scroll-menu")
              .find("li")
              .removeClass("current_page_item");
            $(".one-page-scroll-menu")
              .find("li")
              .removeClass("current-menu-parent");
            $(".one-page-scroll-menu")
              .find("a[href*=\\#" + Sectionid + "]")
              .parent()
              .addClass("current");
          }
        });
      });
    } else {
      $(".one-page-scroll-menu li.current").removeClass("current");
      $(".one-page-scroll-menu li:first").addClass("current");
    }
  }

  // window scroll event
  function stickyMenuUpScroll($targetMenu, $toggleClass) {
    var lastScrollTop = 0;
    window.addEventListener(
      "scroll",
      function () {
        var st = window.pageYOffset || document.documentElement.scrollTop;
        if (st > 500) {
          if (st > lastScrollTop) {
            // downscroll code
            $targetMenu.removeClass($toggleClass);
            // console.log("down");
          } else {
            // upscroll code
            $targetMenu.addClass($toggleClass);
            // console.log("up");
          }
        } else {
          $targetMenu.removeClass($toggleClass);
        }
        lastScrollTop = st;
      },
      false
    );
  }
  stickyMenuUpScroll($(".sticky-header--normal"), "active");

  //Strech Column
  function easilon_stretch() {
    var i = $(window).width();
    $(".row .easilon-stretch-element-inside-column").each(function () {
      var $this = $(this),
        row = $this.closest(".row"),
        cols = $this.closest('[class^="col-"]'),
        colsheight = $this.closest('[class^="col-"]').height(),
        rect = this.getBoundingClientRect(),
        l = row[0].getBoundingClientRect(),
        s = cols[0].getBoundingClientRect(),
        r = rect.left,
        d = i - rect.right,
        c = l.left + (parseFloat(row.css("padding-left")) || 0),
        u = i - l.right + (parseFloat(row.css("padding-right")) || 0),
        p = s.left,
        f = i - s.right,
        styles = {
          "margin-left": 0,
          "margin-right": 0
        };
      if (Math.round(c) === Math.round(p)) {
        var h = parseFloat($this.css("margin-left") || 0);
        styles["margin-left"] = h - r;
      }
      if (Math.round(u) === Math.round(f)) {
        var w = parseFloat($this.css("margin-right") || 0);
        styles["margin-right"] = w - d;
      }
      $this.css(styles);
    });
  }
  easilon_stretch();

  function easilon_cuved_circle() {
    let circleTypeElm = $(".curved-circle--item");
    if (circleTypeElm.length) {
      circleTypeElm.each(function () {
        let elm = $(this);
        let options = elm.data("circle-text-options");
        elm.circleType(
          "object" === typeof options ? options : JSON.parse(options)
        );
      });
    }
  }

  /*-- Price Range --*/
  function priceFilter() {
    if ($(".price-ranger").length) {
      $(".price-ranger #slider-range").slider({
        range: true,
        min: 50,
        max: 1000,
        values: [11, 500],
        slide: function (event, ui) {
          $(".price-ranger .ranger-min-max-block .min").val("$" + ui.values[0]);
          $(".price-ranger .ranger-min-max-block .max").val("$" + ui.values[1]);
        }
      });
      $(".price-ranger .ranger-min-max-block .min").val(
        "$" + $(".price-ranger #slider-range").slider("values", 0)
      );
      $(".price-ranger .ranger-min-max-block .max").val(
        "$" + $(".price-ranger #slider-range").slider("values", 1)
      );
    }
  }

  // window load event

  $(window).on("load", function () {
    if ($(".preloader").length) {
      $(".preloader").fadeOut();
    }
    thmOwlInit();
    thmTinyInit();
    easilonSlickInit();
    priceFilter();

    if ($(".circle-progress").length) {
      $(".circle-progress").appear(function () {
        let circleProgress = $(".circle-progress");
        circleProgress.each(function () {
          let progress = $(this);
          let progressOptions = progress.data("options");
          progress.circleProgress(progressOptions);
        });
      });
    }
    if ($(".masonry-layout").length) {
      $(".masonry-layout").imagesLoaded(function () {
        $(".masonry-layout").isotope({
          layoutMode: "masonry"
        });
      });
    }
    if ($(".fitRow-layout").length) {
      $(".fitRow-layout").imagesLoaded(function () {
        $(".fitRow-layout").isotope({
          layoutMode: "fitRows"
        });
      });
    }

    if ($(".post-filter").length) {
      var postFilterList = $(".post-filter li");
      // for first init
      $(".filter-layout").isotope({
        filter: ".filter-item",
        animationOptions: {
          duration: 500,
          easing: "linear",
          queue: false
        }
      });
      // on click filter links
      postFilterList.on("click", function () {
        var Self = $(this);
        var selector = Self.attr("data-filter");
        postFilterList.removeClass("active");
        Self.addClass("active");

        $(".filter-layout").isotope({
          filter: selector,
          animationOptions: {
            duration: 500,
            easing: "linear",
            queue: false
          }
        });
        return false;
      });
    }

    if ($(".post-filter.has-dynamic-filter-counter").length) {
      // var allItem = $('.single-filter-item').length;

      var activeFilterItem = $(".post-filter.has-dynamic-filter-counter").find(
        "li"
      );

      activeFilterItem.each(function () {
        var filterElement = $(this).data("filter");
        var count = $(".filter-layout").find(filterElement).length;
        $(this).append("<sup>[" + count + "]</sup>");
      });
    }

    easilon_cuved_circle();
  });

  $(window).on("scroll", function () {
    OnePageMenuScroll();
    handleScrollbar();
    if ($(".sticky-header--one-page").length) {
      var headerScrollPos = 130;
      var stricky = $(".sticky-header--one-page");
      if ($(window).scrollTop() > headerScrollPos) {
        stricky.addClass("active");
      } else if ($(this).scrollTop() <= headerScrollPos) {
        stricky.removeClass("active");
      }
    }

    var scrollToTopBtn = ".scroll-to-top";
    if (scrollToTopBtn.length) {
      if ($(window).scrollTop() > 500) {
        $(scrollToTopBtn).addClass("show");
      } else {
        $(scrollToTopBtn).removeClass("show");
      }
    }
  });

  $(window).on("resize", function () {
    easilon_stretch();
  });
})(jQuery);
