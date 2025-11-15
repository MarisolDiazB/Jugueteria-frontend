
const API_BASE_URL = "http://127.0.0.1:8000";
const LOGIN_URL = `${API_BASE_URL}/auth/login`;   
const PRODUCTS_URL = `${API_BASE_URL}/products`;


const CATEGORY_IDS = {
  Construccion: "eb657ccd-0ca7-439b-a3b7-80fb572dd5f3",
  "Juegos de mesa": "c3ce87db-8157-46de-8530-f69b33f25657",
};

// Mapa inverso: UUID -> texto bonito
const CATEGORY_LABELS = Object.fromEntries(
  Object.entries(CATEGORY_IDS).map(([name, id]) => [id, name])
);

const FIXED_SUPPLIER_ID = "e949b638-2016-44ba-a679-3e6d86d558e1";

let products = [];
let productsChart = null;

function getToken() {
  return localStorage.getItem("token");
}

function getAuthHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function setStatus(msg, type = "ok") {
  const el = document.getElementById("status");
  el.textContent = msg;
  el.className = type === "ok" ? "ok" : "error";
}

function getCategoryName(p) {
  return (
    CATEGORY_LABELS[p.category_id] ?? 
    p.category ??                     
    p.categoria ??
    "Sin categoría"
  );
}

// ======================= LOGIN ==========================
async function handleLogin(ev) {
  ev.preventDefault();
  const username = document.getElementById("login-username").value;
  const password = document.getElementById("login-password").value;
  const loginStatus = document.getElementById("login-status");

  loginStatus.textContent = "Iniciando sesión...";

  try {
    const body = new URLSearchParams();
    body.append("grant_type", "password");
    body.append("username", username);
    body.append("password", password);

    const res = await fetch(LOGIN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!res.ok) {
      loginStatus.textContent = "Error en login (credenciales o endpoint)";
      return;
    }

    const data = await res.json();
    const token = data.access_token || data.token;
    if (!token) {
      loginStatus.textContent = "No se encontró token en la respuesta";
      return;
    }

    localStorage.setItem("token", token);
    localStorage.setItem("user", username);

    loginStatus.style.color = "green";
    loginStatus.textContent = "Login exitoso";

    showApp();
  } catch (err) {
    console.error(err);
    loginStatus.textContent = "Error de red al hacer login";
  }
}

function showApp() {
  const user = localStorage.getItem("user") || "";
  document.getElementById("logged-user").textContent = user;
  document.getElementById("login-card").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
  loadProducts();
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  document.getElementById("app").classList.add("hidden");
  document.getElementById("login-card").classList.remove("hidden");
}

// ======================= CRUD PRODUCTOS ==================
async function loadProducts() {
  try {
    const res = await fetch(PRODUCTS_URL, {
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
    });

    if (!res.ok) {
      setStatus("Error al cargar productos", "error");
      return;
    }

    products = await res.json();
    renderProductsTable(products);
    updateChart(products);
    setStatus("Productos cargados correctamente");
  } catch (err) {
    console.error(err);
    setStatus("Error de red al cargar productos", "error");
  }
}

function renderProductsTable(list) {
  const tbody = document.querySelector("#products-table tbody");
  tbody.innerHTML = "";

  list.forEach((p) => {
    const tr = document.createElement("tr");

    const id = p.id ?? p.product_id ?? p.ProductID;
    const name = p.name ?? p.Nombre ?? p.product_name;
    const category = getCategoryName(p);
    const price = p.price ?? p.precio ?? p.Price;

    const tdId = document.createElement("td");
    tdId.textContent = id ?? "";
    tr.appendChild(tdId);

    const tdName = document.createElement("td");
    tdName.textContent = name ?? "";
    tr.appendChild(tdName);

    const tdCategory = document.createElement("td");
    tdCategory.textContent = category ?? "";
    tr.appendChild(tdCategory);

    const tdPrice = document.createElement("td");
    tdPrice.textContent = price ?? "";
    tr.appendChild(tdPrice);

    const tdActions = document.createElement("td");
    tdActions.classList.add("actions");

    const editBtn = document.createElement("button");
    editBtn.textContent = "Editar";
    editBtn.onclick = () =>
      startEditProduct({ id, name, category, price });
    tdActions.appendChild(editBtn);

    const delBtn = document.createElement("button");
    delBtn.textContent = "Eliminar";
    delBtn.onclick = () => deleteProduct(id);
    tdActions.appendChild(delBtn);

    tr.appendChild(tdActions);
    tbody.appendChild(tr);
  });
}

function startEditProduct(p) {
  document.getElementById("product-id").value = p.id ?? "";
  document.getElementById("product-name").value = p.name ?? "";
  document.getElementById("product-category").value = p.category ?? "";
  document.getElementById("product-price").value = p.price ?? "";

  document.getElementById("form-title").textContent = "Editar producto";
  document.getElementById("cancel-edit-btn").classList.remove("hidden");
}

function resetForm() {
  document.getElementById("product-id").value = "";
  document.getElementById("product-form").reset();
  document.getElementById("form-title").textContent = "Crear producto";
  document.getElementById("cancel-edit-btn").classList.add("hidden");
}

async function handleProductForm(ev) {
  ev.preventDefault();

  const id = document.getElementById("product-id").value;
  const name = document.getElementById("product-name").value.trim();
  const categoryText = document
    .getElementById("product-category")
    .value
    .trim();
  const price = parseFloat(
    document.getElementById("product-price").value
  );

  // Intentamos mapear el texto a un ID, si no existe usamos Construccion
  const categoryId =
    CATEGORY_IDS[categoryText] ?? CATEGORY_IDS["Construccion"];

  const body = {
    name,
    price,
    stock: 10,
    category_id: categoryId,
    supplier_id: FIXED_SUPPLIER_ID,
  };

  const method = id ? "PUT" : "POST";
  const url = id ? `${PRODUCTS_URL}/${id}` : PRODUCTS_URL;

  try {
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      setStatus("Error al guardar el producto", "error");
      return;
    }

    await loadProducts();
    resetForm();
    setStatus(id ? "Producto actualizado" : "Producto creado");
  } catch (err) {
    console.error(err);
    setStatus("Error de red al guardar producto", "error");
  }
}

async function deleteProduct(id) {
  if (!id) {
    alert("Este producto no tiene ID");
    return;
  }
  if (!confirm("¿Seguro que deseas eliminar este producto?")) return;

  try {
    const res = await fetch(`${PRODUCTS_URL}/${id}`, {
      method: "DELETE",
      headers: {
        ...getAuthHeaders(),
      },
    });

    if (!res.ok) {
      setStatus("Error al eliminar el producto", "error");
      return;
    }

    await loadProducts();
    setStatus("Producto eliminado");
  } catch (err) {
    console.error(err);
    setStatus("Error de red al eliminar producto", "error");
  }
}

// ======================= FILTRO =========================
function handleFilter() {
  const text = document
    .getElementById("filter-text")
    .value.toLowerCase()
    .trim();

  if (!text) {
    setStatus("Ingresa texto para filtrar", "error");
    return;
  }

  const filtered = products.filter((p) => {
    const name = (p.name ?? p.Nombre ?? "").toLowerCase();
    const categoryName = getCategoryName(p).toLowerCase();
    return name.includes(text) || categoryName.includes(text);
  });

  renderProductsTable(filtered);
  updateChart(filtered);
  setStatus(`Mostrando resultados para "${text}"`);
}

// ======================= GRÁFICA ========================
function updateChart(list) {
  const counts = {};

  list.forEach((p) => {
    const categoryName = getCategoryName(p);
    counts[categoryName] = (counts[categoryName] || 0) + 1;
  });

  const labels = Object.keys(counts);
  const data = Object.values(counts);

  const ctx = document.getElementById("productsChart").getContext("2d");

  if (productsChart) {
    productsChart.destroy();
  }

  productsChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Cantidad de productos",
          data,
          barPercentage: 0.4,      // barras más delgadas
          categoryPercentage: 0.6, // espacio entre barras
        },
      ],
    },
    options: {
      responsive: true,
    },
  });
}

// ======================= INIT ===========================
function init() {
  document
    .getElementById("login-form")
    .addEventListener("submit", handleLogin);

  document
    .getElementById("logout-btn")
    .addEventListener("click", logout);

  document
    .getElementById("product-form")
    .addEventListener("submit", handleProductForm);

  document
    .getElementById("cancel-edit-btn")
    .addEventListener("click", resetForm);

  document
    .getElementById("filter-btn")
    .addEventListener("click", handleFilter);

  document
    .getElementById("reload-btn")
    .addEventListener("click", loadProducts);

  if (getToken()) {
    showApp();
  }
}

document.addEventListener("DOMContentLoaded", init);
