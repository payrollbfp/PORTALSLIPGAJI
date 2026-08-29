const API_URL = window.APP_CONFIG?.API_URL || "";

const MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember"
];

const state = {
  token: sessionStorage.getItem("bfpToken") || "",
  user: null,
  employees: [],
  slips: [],
  pdfUrl: "",
  pdfName: "slip-gaji.pdf"
};

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("copyrightYear").textContent = new Date().getFullYear();

  MONTHS.forEach(function (month, index) {
    $("slipMonth").add(
      new Option(month, String(index + 1))
    );
  });

  bindEvents();

  if (state.token) {
    try {
      const data = await api("session");
      state.user = data.user;
      showApp();
    } catch (error) {
      clearSession();
    }
  }
}

function bindEvents() {
  $("loginForm").addEventListener("submit", login);

  $("togglePassword").addEventListener("click", function () {
    const field = $("password");

    field.type =
      field.type === "password" ? "text" : "password";
  });

  document
    .querySelectorAll("[data-logout]")
    .forEach(function (button) {
      button.addEventListener("click", logout);
    });

  $("showSlipButton").addEventListener(
    "click",
    showSlip
  );

  $("viewPdfButton").addEventListener(
    "click",
    function () {
      if (state.pdfUrl) {
        window.open(
          state.pdfUrl,
          "_blank",
          "noopener"
        );
      }
    }
  );

  $("downloadPdfButton").addEventListener(
    "click",
    downloadPdf
  );

  document
    .querySelectorAll("[data-admin-tab]")
    .forEach(function (button) {
      button.addEventListener(
        "click",
        function () {
          switchAdminTab(
            button.dataset.adminTab
          );
        }
      );
    });

  $("employeeSearch").addEventListener(
    "input",
    renderEmployees
  );

  $("slipSearch").addEventListener(
    "input",
    renderSlips
  );

  $("addEmployeeButton").addEventListener(
    "click",
    function () {
      openEmployeeDialog();
    }
  );

  $("addSlipButton").addEventListener(
    "click",
    function () {
      openSlipDialog();
    }
  );

  $("employeeForm").addEventListener(
    "submit",
    saveEmployee
  );

  $("slipForm").addEventListener(
    "submit",
    saveSlip
  );

  document
    .querySelectorAll("[data-close-dialog]")
    .forEach(function (button) {
      button.addEventListener(
        "click",
        function () {
          button.closest("dialog").close();
        }
      );
    });
}

async function api(action, payload = {}) {
  if (
    !API_URL ||
    API_URL.includes("PASTE_URL")
  ) {
    throw new Error(
      "URL backend belum diatur pada config.js"
    );
  }

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type":
        "text/plain;charset=utf-8"
    },
    body: JSON.stringify({
      action: action,
      token: state.token,
      ...payload
    }),
    redirect: "follow"
  });

  const result = await response.json();

  if (!result.ok) {
    throw new Error(
      result.message || "Permintaan gagal"
    );
  }

  return result.data;
}

async function login(event) {
  event.preventDefault();

  const button = $("loginButton");

  setLoading(
    button,
    true,
    "Memeriksa..."
  );

  try {
    const data = await api("login", {
      nik: $("nik").value.trim(),
      password: $("password").value
    });

    state.token = data.token;
    state.user = data.user;

    sessionStorage.setItem(
      "bfpToken",
      state.token
    );

    showApp();
    toast("Login berhasil.");
  } catch (error) {
    toast(error.message, true);
  } finally {
    setLoading(
      button,
      false,
      "Masuk"
    );
  }
}

function showApp() {
  $("loginView").classList.add("hidden");

  if (state.user.role === "ADMIN") {
    $("adminApp").classList.remove(
      "hidden"
    );

    loadAdmin();
  } else {
    $("employeeApp").classList.remove(
      "hidden"
    );

    $("employeeName").textContent =
      state.user.name;

    $("employeeProject").textContent =
      state.user.project;

    loadPeriods();
  }
}

async function logout() {
  try {
    await api("logout");
  } catch (error) {
    // Sesi lokal tetap dibersihkan.
  }

  clearSession();
  location.reload();
}

function clearSession() {
  state.token = "";
  state.user = null;

  sessionStorage.removeItem("bfpToken");
}

async function loadPeriods() {
  try {
    const data = await api("getPeriods");

    const periods = data.periods || [];

    const months = [
      ...new Set(
        periods.map(function (period) {
          return Number(period.month);
        })
      )
    ];

    const years = [
      ...new Set(
        periods.map(function (period) {
          return Number(period.year);
        })
      )
    ].sort(function (a, b) {
      return b - a;
    });

    fillSelect(
      $("monthSelect"),
      months.map(function (month) {
        return {
          value: month,
          label: MONTHS[month - 1]
        };
      }),
      "Pilih bulan"
    );

    fillSelect(
      $("yearSelect"),
      years.map(function (year) {
        return {
          value: year,
          label: year
        };
      }),
      "Pilih tahun"
    );
  } catch (error) {
    toast(error.message, true);
  }
}

async function showSlip() {
  const month = $("monthSelect").value;
  const year = $("yearSelect").value;

  if (!month || !year) {
    toast(
      "Pilih bulan dan tahun terlebih dahulu.",
      true
    );

    return;
  }

  const button = $("showSlipButton");

  setLoading(
    button,
    true,
    "Memuat..."
  );

  revokePdf();

  try {
    const data = await api("getSlip", {
      month: Number(month),
      year: Number(year)
    });

    const binary = atob(data.base64);

    const bytes = new Uint8Array(
      binary.length
    );

    for (
      let index = 0;
      index < binary.length;
      index++
    ) {
      bytes[index] =
        binary.charCodeAt(index);
    }

    const blob = new Blob(
      [bytes],
      {
        type: "application/pdf"
      }
    );

    state.pdfUrl =
      URL.createObjectURL(blob);

    state.pdfName =
      data.fileName ||
      "Slip-" +
        MONTHS[Number(month) - 1] +
        "-" +
        year +
        ".pdf";

    $("pdfFrame").src = state.pdfUrl;

    $("pdfFrame").classList.remove(
      "hidden"
    );

    $("emptySlip").classList.add(
      "hidden"
    );

    $("viewPdfButton").disabled = false;

    $("downloadPdfButton").disabled =
      false;
  } catch (error) {
    toast(error.message, true);
  } finally {
    setLoading(
      button,
      false,
      "Tampilkan Slip Gaji"
    );
  }
}

function downloadPdf() {
  if (!state.pdfUrl) {
    return;
  }

  const link =
    document.createElement("a");

  link.href = state.pdfUrl;
  link.download = state.pdfName;

  document.body.appendChild(link);
  link.click();
  link.remove();
}

function revokePdf() {
  if (state.pdfUrl) {
    URL.revokeObjectURL(
      state.pdfUrl
    );
  }

  state.pdfUrl = "";

  $("viewPdfButton").disabled = true;

  $("downloadPdfButton").disabled =
    true;
}

async function loadAdmin() {
  await loadEmployees();
}

async function loadEmployees() {
  try {
    const data = await api(
      "adminListEmployees"
    );

    state.employees =
      data.employees || [];

    renderEmployees();
  } catch (error) {
    toast(error.message, true);
  }
}

async function loadSlips() {
  try {
    const data = await api(
      "adminListSlips"
    );

    state.slips = data.slips || [];

    renderSlips();
  } catch (error) {
    toast(error.message, true);
  }
}

async function switchAdminTab(tab) {
  document
    .querySelectorAll("[data-admin-tab]")
    .forEach(function (button) {
      button.classList.toggle(
        "active",
        button.dataset.adminTab === tab
      );
    });

  $("employeesTab").classList.toggle(
    "hidden",
    tab !== "employees"
  );

  $("slipsTab").classList.toggle(
    "hidden",
    tab !== "slips"
  );

  if (
    tab === "employees" &&
    state.employees.length === 0
  ) {
    await loadEmployees();
  }

  if (
    tab === "slips" &&
    state.slips.length === 0
  ) {
    await loadSlips();
  }
}

function renderEmployees() {
  const keyword = $("employeeSearch")
    .value
    .toLowerCase();

  const rows = state.employees.filter(
    function (employee) {
      const combined = [
        employee.nik,
        employee.nopeg,
        employee.name,
        employee.project
      ]
        .join(" ")
        .toLowerCase();

      return combined.includes(keyword);
    }
  );

  $("employeeTableBody").innerHTML =
    rows
      .map(function (employee) {
        return `
          <tr>
            <td>${escapeHtml(employee.nik)}</td>
            <td>${escapeHtml(employee.nopeg)}</td>
            <td>${escapeHtml(employee.name)}</td>
            <td>${escapeHtml(employee.project)}</td>
            <td>${escapeHtml(employee.role)}</td>
            <td>
              <button
                class="action-button"
                onclick="editEmployee('${escapeAttribute(
                  employee.nik
                )}')"
              >
                Edit
              </button>

              <button
                class="action-button danger"
                onclick="deleteEmployee('${escapeAttribute(
                  employee.nik
                )}')"
              >
                Hapus
              </button>
            </td>
          </tr>
        `;
      })
      .join("") || emptyRow(6);

  $("employeeCount").textContent =
    rows.length + " Data Karyawan";
}

function renderSlips() {
  const keyword = $("slipSearch")
    .value
    .toLowerCase();

  const rows = state.slips.filter(
    function (slip) {
      const combined = [
        slip.nik,
        slip.name,
        slip.fileName,
        slip.month,
        slip.year
      ]
        .join(" ")
        .toLowerCase();

      return combined.includes(keyword);
    }
  );

  $("slipTableBody").innerHTML =
    rows
      .map(function (slip) {
        return `
          <tr>
            <td>${escapeHtml(slip.nik)}</td>
            <td>${escapeHtml(slip.name)}</td>
            <td>
              ${escapeHtml(
                MONTHS[slip.month - 1]
              )}
              ${escapeHtml(slip.year)}
            </td>
            <td>${escapeHtml(
              slip.fileName
            )}</td>
            <td>
              <button
                class="action-button"
                onclick="editSlip('${escapeAttribute(
                  slip.id
                )}')"
              >
                Edit
              </button>

              <button
                class="action-button danger"
                onclick="deleteSlip('${escapeAttribute(
                  slip.id
                )}')"
              >
                Hapus
              </button>
            </td>
          </tr>
        `;
      })
      .join("") || emptyRow(5);

  $("slipCount").textContent =
    rows.length + " Data Slip Gaji";
}

function openEmployeeDialog(
  employee = null
) {
  $("employeeDialogTitle").textContent =
    employee
      ? "Edit Karyawan"
      : "Tambah Karyawan";

  $("employeeOriginalNik").value =
    employee?.nik || "";

  $("employeeNik").value =
    employee?.nik || "";

  $("employeeNopeg").value =
    employee?.nopeg || "";

  $("employeeFullName").value =
    employee?.name || "";

  $("employeeProjectInput").value =
    employee?.project || "";

  $("employeeRole").value =
    employee?.role || "EMPLOYEE";

  $("employeeActive").value = String(
    employee?.active ?? true
  ).toUpperCase();

  $("employeePassword").value = "";

  $("employeeDialog").showModal();
}

window.editEmployee = function (nik) {
  const employee =
    state.employees.find(
      function (item) {
        return item.nik === nik;
      }
    );

  if (employee) {
    openEmployeeDialog(employee);
  }
};

async function saveEmployee(event) {
  event.preventDefault();

  try {
    await api("adminSaveEmployee", {
      employee: {
        originalNik:
          $("employeeOriginalNik").value,

        nik:
          $("employeeNik")
            .value
            .trim(),

        nopeg:
          $("employeeNopeg")
            .value
            .trim(),

        name:
          $("employeeFullName")
            .value
            .trim(),

        project:
          $("employeeProjectInput")
            .value
            .trim(),

        role:
          $("employeeRole").value,

        active:
          $("employeeActive").value ===
          "TRUE",

        password:
          $("employeePassword").value
      }
    });

    $("employeeDialog").close();

    toast(
      "Data karyawan tersimpan."
    );

    await loadEmployees();
  } catch (error) {
    toast(error.message, true);
  }
}

window.deleteEmployee =
  async function (nik) {
    const confirmed = confirm(
      "Hapus karyawan dengan NIK " +
        nik +
        "?"
    );

    if (!confirmed) {
      return;
    }

    try {
      await api(
        "adminDeleteEmployee",
        {
          nik: nik
        }
      );

      toast(
        "Data karyawan dihapus."
      );

      await loadEmployees();
    } catch (error) {
      toast(error.message, true);
    }
  };

function openSlipDialog(slip = null) {
  $("slipDialogTitle").textContent =
    slip
      ? "Edit Slip Gaji"
      : "Tambah Slip Gaji";

  $("slipId").value =
    slip?.id || "";

  $("slipNik").value =
    slip?.nik || "";

  $("slipMonth").value =
    slip?.month ||
    String(new Date().getMonth() + 1);

  $("slipYear").value =
    slip?.year ||
    new Date().getFullYear();

  $("driveFileId").value =
    slip?.driveFileId || "";

  $("slipFileName").value =
    slip?.fileName || "";

  $("slipDialog").showModal();
}

window.editSlip = function (id) {
  const slip = state.slips.find(
    function (item) {
      return item.id === id;
    }
  );

  if (slip) {
    openSlipDialog(slip);
  }
};

async function saveSlip(event) {
  event.preventDefault();

  try {
    await api("adminSaveSlip", {
      slip: {
        id:
          $("slipId").value,

        nik:
          $("slipNik")
            .value
            .trim(),

        month:
          Number(
            $("slipMonth").value
          ),

        year:
          Number(
            $("slipYear").value
          ),

        driveFileId:
          $("driveFileId")
            .value
            .trim(),

        fileName:
          $("slipFileName")
            .value
            .trim()
      }
    });

    $("slipDialog").close();

    toast("Data slip tersimpan.");

    await loadSlips();
  } catch (error) {
    toast(error.message, true);
  }
}

window.deleteSlip =
  async function (id) {
    const confirmed = confirm(
      "Hapus data slip gaji ini?"
    );

    if (!confirmed) {
      return;
    }

    try {
      await api(
        "adminDeleteSlip",
        {
          id: id
        }
      );

      toast("Data slip dihapus.");

      await loadSlips();
    } catch (error) {
      toast(error.message, true);
    }
  };

function fillSelect(
  element,
  items,
  placeholder
) {
  element.innerHTML =
    '<option value="">' +
    placeholder +
    "</option>";

  items.forEach(function (item) {
    element.add(
      new Option(
        item.label,
        item.value
      )
    );
  });
}

function setLoading(
  button,
  loading,
  text
) {
  button.disabled = loading;
  button.textContent = text;
}

function toast(
  message,
  isError = false
) {
  const element = $("toast");

  element.textContent = message;

  element.classList.toggle(
    "error",
    isError
  );

  element.classList.add("show");

  clearTimeout(toast.timer);

  toast.timer = setTimeout(
    function () {
      element.classList.remove("show");
    },
    3500
  );
}

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>'"]/g,
    function (character) {
      const characters = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;"
      };

      return characters[character];
    }
  );
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(
    /`/g,
    "&#96;"
  );
}

function emptyRow(columns) {
  return `
    <tr>
      <td
        colspan="${columns}"
        style="text-align:center;color:#7a8495"
      >
        Belum ada data.
      </td>
    </tr>
  `;
}
