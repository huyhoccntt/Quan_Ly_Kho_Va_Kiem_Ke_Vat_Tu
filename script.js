(() => {
  const KEYS = {
    session: "inventory-manager.session.v1",
    inventory: "inventory-manager.inventory.v1",
    suppliers: "inventory-manager.suppliers.v1",
    stocktakes: "inventory-manager.stocktakes.v1",
    createdReceipts: "inventory-manager.created-receipts.v1",
    deletedReceipts: "inventory-manager.deleted-receipts.v1",
    approvedReceipts: "inventory-manager.approved-receipts.v1",
    createdOutbound: "inventory-manager.created-outbound.v1",
    deletedOutbound: "inventory-manager.deleted-outbound.v1",
    approvedOutbound: "inventory-manager.approved-outbound.v1",
  };
  const demoCredentials = { username: "admin", password: "kho123" };

  // Đọc dữ liệu JSON đã lưu trong localStorage; báo lỗi và dùng giá trị dự phòng khi cần.
  const read = (key, fallback) => {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch (error) {
      console.error(`Không thể đọc dữ liệu ${key}.`, error);
      window.alert("Dữ liệu lưu trên trình duyệt bị lỗi, vui lòng kiểm tra console.");
      return fallback;
    }
  };

  // Chuyển dữ liệu thành JSON và lưu vào localStorage.
  const write = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Không thể lưu dữ liệu ${key}.`, error);
      window.alert("Không thể lưu dữ liệu trên trình duyệt này.");
      return false;
    }
  };

  // Tạo một ô bảng an toàn bằng textContent và thêm vào hàng.
  const cell = (row, value) => {
    const td = document.createElement("td");
    td.textContent = String(value ?? "");
    row.append(td);
    return td;
  };

  // Đổi ngày dạng YYYY-MM-DD sang DD/MM/YYYY để hiển thị.
  const formatDate = (date) => {
    if (!date) return "";
    const [year, month, day] = date.split("-");
    return year && month && day ? `${day}/${month}/${year}` : date;
  };

  // Trả về ngày hiện tại theo định dạng YYYY-MM-DD cho trường ngày.
  const todayIso = () => new Date().toISOString().slice(0, 10);

  // Tạo và tải tệp CSV từ tiêu đề cột cùng các hàng dữ liệu.
  const downloadCsv = (fileName, headers, rows) => {
    // Bọc giá trị trong dấu ngoặc kép và thoát dấu ngoặc kép bên trong.
    const quote = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = [headers, ...rows]
      .map((row) => row.map(quote).join(","))
      .join("\r\n");
    const fileUrl = URL.createObjectURL(
      new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = fileUrl;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(fileUrl);
  };

  // Xử lý đăng nhập mẫu và chuyển người dùng đã đăng nhập đến trang tổng quan.
  const initializeLogin = () => {
    const form = document.querySelector("#login-form");
    if (!form) return false;
    const activeSession = read(KEYS.session, null);
    if (activeSession?.username) {
      window.location.replace("index.html");
      return true;
    }
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const username = form.elements.username.value.trim();
      const password = form.elements.password.value;
      if (
        username !== demoCredentials.username ||
        password !== demoCredentials.password
      ) {
        const message = document.querySelector("#login-error");
        message.textContent = "Tên đăng nhập hoặc mật khẩu không đúng.";
        message.hidden = false;
        return;
      }
      if (write(KEYS.session, { username, name: "Trần Manh Huy" })) {
        window.location.replace("index.html");
      }
    });
    return true;
  };

  // Kiểm tra phiên đăng nhập; nếu chưa đăng nhập thì chuyển sang trang đăng nhập.
  const guardSession = () => {
    const session = read(KEYS.session, null);
    if (!session?.username) {
      window.location.replace("login.html");
      return null;
    }
    return session;
  };

  // Hiển thị tên tài khoản và gắn thao tác đăng xuất lên phần đầu trang.
  const setupHeader = (session) => {
    document.querySelectorAll(".top-right").forEach((header) => {
      const userName = [...header.querySelectorAll("span")]
        .filter((item) => !item.classList.contains("user") && !item.classList.contains("top-date"))
        .at(-1);
      if (userName) userName.textContent = session.name || session.username;
      if (header.querySelector("[data-logout]")) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "button";
      button.dataset.logout = "true";
      button.textContent = "Đăng xuất";
      button.addEventListener("click", () => {
        localStorage.removeItem(KEYS.session);
        window.location.replace("login.html");
      });
      header.append(button);
    });
  };

  // Chuyển các hàng vật tư mẫu trong HTML thành danh sách dữ liệu có kiểu phù hợp.
  const parseInventoryRows = (tbody) =>
    [...tbody.rows].map((row) => {
      const values = [...row.cells].map((item) => item.textContent.trim());
      const quantity = values[4].match(/[\d,.]+/)?.[0] ?? "0";
      const minimum = values[5].match(/[\d,.]+/)?.[0] ?? "0";
      const unit = values[4].replace(/[\d,.]+\s*/, "").trim();
      return {
        code: values[0],
        name: values[1],
        group: values[2],
        location: values[3],
        quantity: Number(quantity.replaceAll(",", "")) || 0,
        unit,
        minimum: Number(minimum.replaceAll(",", "")) || 0,
      };
    });

  // Khởi tạo danh sách tồn kho, thêm vật tư mới và xuất danh mục ra CSV.
  const setupInventory = () => {
    const tbody = document.querySelector("#inventory-list");
    if (!tbody) return;
    const items = read(KEYS.inventory, parseInventoryRows(tbody));
    if (!Array.isArray(items)) {
      window.alert("Danh mục vật tư lưu trữ không hợp lệ.");
      return;
    }
    // Xác định nhãn và kiểu hiển thị trạng thái tồn kho của một vật tư.
    const statusFor = (item) =>
      item.quantity <= 0
        ? ["Hết hàng", "empty"]
        : item.quantity < item.minimum
          ? ["Sắp hết", "low"]
          : ["Còn hàng", "good"];
    // Vẽ lại danh sách vật tư và cập nhật các số liệu tổng quan.
    const render = () => {
      tbody.replaceChildren();
      items.forEach((item) => {
        const row = document.createElement("tr");
        cell(row, item.code);
        const name = cell(row, item.name);
        name.className = "product";
        cell(row, item.group);
        cell(row, item.location);
        cell(row, `${item.quantity} ${item.unit}`);
        cell(row, `${item.minimum} ${item.unit}`);
        const [label, className] = statusFor(item);
        const status = cell(row, "");
        const badge = document.createElement("span");
        badge.className = `status ${className}`;
        badge.textContent = label;
        status.append(badge);
        tbody.append(row);
      });
      const count = document.querySelector("#product-count");
      if (count) count.textContent = String(items.length);
      const lows = document.querySelector("#low-count");
      if (lows)
        lows.textContent = String(
          items.filter((item) => item.quantity < item.minimum).length,
        ).padStart(2, "0");
    };
    render();
    const form = document.querySelector("#item-form");
    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      const item = {
        code: form.elements["item-code"].value.trim(),
        name: form.elements["item-name"].value.trim(),
        group: form.elements["item-group"].value,
        location: form.elements["item-location"].value.trim(),
        quantity: Number(form.elements["item-quantity"].value),
        unit: form.elements["item-unit"].value.trim(),
        minimum: Number(form.elements["item-minimum"].value),
      };
      if (items.some((existing) => existing.code.toLowerCase() === item.code.toLowerCase())) {
        window.alert("Mã vật tư đã tồn tại.");
        return;
      }
      const next = [...items, item];
      if (!write(KEYS.inventory, next)) return;
      items.push(item);
      render();
      form.reset();
      window.alert(`Đã thêm vật tư ${item.code}.`);
    });
    document.querySelector("#export-inventory")?.addEventListener("click", () => {
      downloadCsv(
        "danh-muc-ton-kho.csv",
        ["Mã vật tư", "Tên vật tư", "Nhóm", "Vị trí", "Tồn kho", "Đơn vị", "Định mức"],
        items.map((item) => [
          item.code,
          item.name,
          item.group,
          item.location,
          item.quantity,
          item.unit,
          item.minimum,
        ]),
      );
    });
  };

  // Đồng bộ danh sách vật tư giữa các kho và hiển thị số lượng/trạng thái liên quan.
  const setupWarehouses = () => {
    const warehouseTables = [...document.querySelectorAll("[data-warehouse-code] tbody")];
    if (!warehouseTables.length) return;
    const inventory = read(KEYS.inventory, null);
    if (inventory !== null && !Array.isArray(inventory)) {
      window.alert("Danh mục vật tư lưu trữ không hợp lệ.");
      return;
    }
    const catalogByCode = new Map();
    warehouseTables.forEach((tbody) => {
      [...tbody.rows].forEach((row) => {
        const [code, name] = [...row.cells].map((item) => item.textContent.trim());
        if (code && !catalogByCode.has(code)) {
          catalogByCode.set(code, { code, name });
        }
      });
    });
    (inventory || []).forEach((item) => {
      if (!catalogByCode.has(item.code)) catalogByCode.set(item.code, item);
    });
    warehouseTables.forEach((tbody) => {
      const warehouseCode = tbody.closest("[data-warehouse-code]").dataset.warehouseCode;
      const existingCodes = new Set(
        [...tbody.rows].map((row) => row.cells[0].textContent.trim()),
      );
      catalogByCode.forEach((item, code) => {
        if (existingCodes.has(code)) return;
        const isCentral = warehouseCode === "KHO-HN-01" && inventory?.some((saved) => saved.code === code);
        const row = document.createElement("tr");
        cell(row, code);
        cell(row, item.name);
        cell(row, isCentral ? item.location : "Chưa cập nhật");
        cell(row, isCentral ? `${item.quantity} ${item.unit}` : "Chưa cập nhật");
        const status = cell(row, "");
        const badge = document.createElement("span");
        if (isCentral) {
          const [label, className] =
            item.quantity <= 0
              ? ["Hết hàng", "empty"]
              : item.quantity < item.minimum
                ? ["Sắp hết", "low"]
                : ["Còn hàng", "good"];
          badge.className = `status ${className}`;
          badge.textContent = label;
        } else {
          badge.className = "status";
          badge.textContent = "Chưa cập nhật";
        }
        status.append(badge);
        tbody.append(row);
      });
    });
    const itemCount = document.querySelector("#warehouse-item-count");
    if (itemCount) itemCount.textContent = String(catalogByCode.size).padStart(2, "0");
  };

  // Khởi tạo danh sách nhà cung cấp, thêm/sửa thông tin và cập nhật lựa chọn phiếu nhập.
  const setupSuppliers = () => {
    const tbody = document.querySelector("#supplier-list");
    const form = document.querySelector("#supplier-form");
    const supplierSelect = document.querySelector("#receipt-supplier");
    let editingCode = null;
    let suppliers;
    if (tbody) {
      const seeded = [...tbody.rows].map((row) => ({
        code: row.cells[0].textContent.trim(),
        name: row.cells[1].textContent.trim(),
        group: row.cells[2].textContent.trim(),
        contact: row.cells[3].textContent.trim(),
        phone: row.cells[4].textContent.trim(),
        email: row.cells[5].textContent.trim() === "—" ? "" : row.cells[5].textContent.trim(),
        receipts: row.cells[6].textContent.trim(),
        status: row.cells[7].textContent.trim(),
      }));
      suppliers = read(KEYS.suppliers, seeded);
      if (!Array.isArray(suppliers)) {
        window.alert("Danh sách nhà cung cấp lưu trữ không hợp lệ.");
        suppliers = seeded;
      }
      // Vẽ lại bảng nhà cung cấp từ dữ liệu đang lưu.
      const render = () => {
        tbody.replaceChildren();
        suppliers.forEach((supplier) => {
          const row = document.createElement("tr");
          row.dataset.supplierCode = supplier.code;
          [
            supplier.code,
            supplier.name,
            supplier.group,
            supplier.contact,
            supplier.phone,
            supplier.email || "—",
            supplier.receipts || "0",
          ].forEach((value) => cell(row, value));
          const status = cell(row, "");
          const badge = document.createElement("span");
          badge.className = "status good";
          badge.textContent = supplier.status || "Đang hợp tác";
          status.append(badge);
          const actions = cell(row, "");
          const editButton = document.createElement("button");
          editButton.type = "button";
          editButton.className = "button";
          editButton.dataset.action = "edit-supplier";
          editButton.textContent = "Sửa";
          actions.append(editButton);
          tbody.append(row);
        });
      };
      render();
      // Thoát chế độ sửa và đưa biểu mẫu nhà cung cấp về trạng thái thêm mới.
      const resetForm = () => {
        editingCode = null;
        form?.reset();
        const title = document.querySelector("#supplier-form-title");
        const saveButton = document.querySelector("#save-supplier");
        const cancelButton = document.querySelector("#cancel-supplier-edit");
        if (title) title.textContent = "Thêm nhà cung cấp";
        if (saveButton) saveButton.textContent = "Lưu nhà cung cấp";
        if (cancelButton) cancelButton.hidden = true;
      };
      tbody.addEventListener("click", (event) => {
        const button = event.target instanceof Element
          ? event.target.closest('[data-action="edit-supplier"]')
          : null;
        const code = button?.closest("tr")?.dataset.supplierCode;
        const supplier = suppliers.find((item) => item.code === code);
        if (!supplier) return;
        editingCode = supplier.code;
        form.elements.name.value = supplier.name;
        form.elements.group.value = supplier.group;
        form.elements.contact.value = supplier.contact;
        form.elements.phone.value = supplier.phone;
        form.elements.email.value = supplier.email || "";
        document.querySelector("#supplier-form-title").textContent = "Chỉnh sửa nhà cung cấp";
        document.querySelector("#save-supplier").textContent = "Lưu thay đổi";
        document.querySelector("#cancel-supplier-edit").hidden = false;
        form.scrollIntoView({ behavior: "smooth", block: "center" });
        form.elements.name.focus();
      });
      document.querySelector("#cancel-supplier-edit")?.addEventListener("click", resetForm);
      form?.addEventListener("submit", (event) => {
        event.preventDefault();
        const values = new FormData(form);
        const name = String(values.get("name")).trim();
        if (suppliers.some((supplier) =>
          supplier.code !== editingCode && supplier.name.toLowerCase() === name.toLowerCase()
        )) {
          window.alert("Nhà cung cấp này đã có trong danh sách.");
          return;
        }
        const details = {
          name,
          group: String(values.get("group")).trim(),
          contact: String(values.get("contact")).trim(),
          phone: String(values.get("phone")).trim(),
          email: String(values.get("email")).trim(),
        };
        if (editingCode) {
          const index = suppliers.findIndex((supplier) => supplier.code === editingCode);
          if (index < 0) {
            window.alert("Không tìm thấy nhà cung cấp cần chỉnh sửa.");
            resetForm();
            return;
          }
          const next = suppliers.map((supplier) =>
            supplier.code === editingCode ? { ...supplier, ...details } : supplier
          );
          if (!write(KEYS.suppliers, next)) return;
          suppliers = next;
          render();
          resetForm();
          window.alert(`Đã cập nhật thông tin nhà cung cấp ${name}.`);
          return;
        }
        const maxCode = suppliers.reduce((max, supplier) => {
          return Math.max(max, Number(supplier.code.match(/\d+$/)?.[0] || 0));
        }, 0);
        const supplier = {
          code: `NCC-${String(maxCode + 1).padStart(3, "0")}`,
          ...details,
          receipts: "0",
          status: "Đang hợp tác",
        };
        const next = [...suppliers, supplier];
        if (!write(KEYS.suppliers, next)) return;
        suppliers.push(supplier);
        render();
        form.reset();
        window.alert(`Đã thêm nhà cung cấp ${supplier.name}.`);
      });
    }
    if (supplierSelect) {
      const savedSuppliers = read(KEYS.suppliers, null);
      if (Array.isArray(savedSuppliers)) {
        const selected = supplierSelect.value;
        supplierSelect.replaceChildren(new Option("Chọn nhà cung cấp", ""));
        savedSuppliers.forEach((supplier) =>
          supplierSelect.add(new Option(supplier.name, supplier.name)),
        );
        supplierSelect.value = selected;
      }
    }
  };

  // Khởi tạo kiểm kê, quản lý số đếm và hiển thị lịch sử phiếu nhập/xuất.
  const setupStocktakes = () => {
    const tbody = document.querySelector("#stocktake-list");
    const form = document.querySelector("#stocktake-form");
    const panel = document.querySelector("#stocktake-form-panel");
    if (!tbody) return;
    const button = document.querySelector("#show-stocktake-form");
    button?.addEventListener("click", () => {
      panel.hidden = false;
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
      document.querySelector("#stocktake-area")?.focus();
    });
    const batches = read(KEYS.stocktakes, []);
    if (!Array.isArray(batches)) {
      window.alert("Danh sách đợt kiểm kê lưu trữ không hợp lệ.");
      return;
    }
    const defaultItems = [
      { code: "VT-00124", name: "Dây điện Cadivi 2.5mm", quantity: 148, unit: "cuộn", minimum: 40 },
      { code: "VT-00087", name: "Bu lông lục giác M10 x 50", quantity: 18, unit: "cái", minimum: 50 },
      { code: "VT-00056", name: "Găng tay bảo hộ phủ PU", quantity: 12, unit: "đôi", minimum: 30 },
      { code: "VT-00102", name: "CB tép 2P 20A LS", quantity: 64, unit: "cái", minimum: 20 },
      { code: "VT-00031", name: "Băng keo cách điện Nano", quantity: 8, unit: "cuộn", minimum: 25 },
      { code: "VT-00093", name: "Mũi khoan thép HSS 8mm", quantity: 0, unit: "cái", minimum: 10 },
    ];
    const inventory = read(KEYS.inventory, defaultItems);
    if (!Array.isArray(inventory)) {
      window.alert("Danh mục vật tư lưu trữ không hợp lệ.");
      return;
    }
    const records = new Map(batches.map((batch) => [batch.number, batch]));
    [...tbody.rows].forEach((row) => {
      const number = row.cells[0].textContent.trim();
      const stored = records.get(number);
      if (stored) {
        row.cells[1].textContent = stored.area;
        row.cells[2].textContent = stored.date;
        row.cells[3].textContent = stored.manager;
        row.cells[4].textContent = stored.progress;
        row.cells[5].textContent = stored.difference;
        const badge = row.cells[6].querySelector(".status");
        badge.textContent = stored.status;
        badge.className = stored.status === "Hoàn tất" ? "status good" : "status low";
      } else {
        records.set(number, {
          number,
          area: row.cells[1].textContent.trim(),
          date: row.cells[2].textContent.trim(),
          manager: row.cells[3].textContent.trim(),
          progress: row.cells[4].textContent.trim(),
          difference: row.cells[5].textContent.trim(),
          status: row.cells[6].textContent.trim(),
          items: [],
          sample: number === "KK-2026-004",
        });
      }
      addBatchAction(row);
    });
    batches.forEach((batch) => {
      if (![...tbody.rows].some((row) => row.cells[0].textContent.trim() === batch.number)) renderBatch(batch);
    });
    let activeBatch = null;
    const detail = document.querySelector("#stocktake-detail");
    const itemBody = document.querySelector("#stocktake-items");
    const completeButton = document.querySelector("#complete-stocktake");
    // Hiển thị vật tư của đợt kiểm kê, số lượng sổ, số đếm và chênh lệch.
    const renderItems = (batch) => {
      itemBody.replaceChildren();
      const isReadOnly = batch.status === "Hoàn tất";
      (batch.items || []).forEach((item) => {
        const row = document.createElement("tr");
        cell(row, item.code);
        cell(row, item.name);
        cell(row, `${item.expected} ${item.unit}`);
        const countCell = cell(row, "");
        const input = document.createElement("input");
        input.type = "number";
        input.min = "0";
        input.step = "1";
        input.className = "field stocktake-count-input";
        input.dataset.itemCode = item.code;
        input.value = item.counted === null ? "" : String(item.counted);
        input.placeholder = "Nhập số lượng";
        input.disabled = isReadOnly;
        input.setAttribute("aria-label", `Số lượng thực đếm ${item.name}`);
        countCell.append(input);
        const diffCell = cell(row, "");
        diffCell.textContent =
          item.counted === null
            ? "Chưa đếm"
            : item.counted - item.expected > 0
              ? `+${item.counted - item.expected} ${item.unit}`
              : `${item.counted - item.expected} ${item.unit}`;
        itemBody.append(row);
      });
      document.querySelector("#stocktake-detail-heading").textContent =
        `Kiểm kê ${batch.number} · ${batch.area}`;
      const hasSavedCounts = (batch.items || []).some((item) => item.counted !== null);
      document.querySelector("#stocktake-detail-note").textContent = batch.sample
        ? "Dữ liệu đếm bên dưới chỉ để minh họa; hãy thay bằng số lượng thực tế trước khi lưu."
        : isReadOnly
        ? hasSavedCounts
          ? "Đợt đã hoàn tất; thông tin kiểm đếm được mở ở chế độ chỉ xem."
          : "Đợt mẫu này được tạo trước khi lưu số đếm chi tiết; danh sách vật tư chỉ để tham khảo."
        : "Nhập số lượng thực tế cho từng vật tư. Có thể lưu tiến độ và tiếp tục sau.";
      document.querySelector("#stocktake-detail-actions").hidden = isReadOnly;
      completeButton.disabled = !batch.items.length || batch.items.some((item) => item.counted === null);
    };
    // Lưu số lượng đã đếm và cập nhật tiến độ; có thể đánh dấu đợt hoàn tất.
    const saveCounts = (complete = false) => {
      if (!activeBatch) return;
      const updatedItems = activeBatch.items.map((item) => {
        const input = [...itemBody.querySelectorAll(".stocktake-count-input")].find(
          (field) => field.dataset.itemCode === item.code,
        );
        const value = input.value.trim();
        return { ...item, counted: value === "" ? null : Number(value) };
      });
      if (
        updatedItems.some(
          (item) => item.counted !== null && (!Number.isInteger(item.counted) || item.counted < 0),
        )
      ) {
        window.alert("Số lượng thực đếm phải là số nguyên không âm.");
        return;
      }
      if (complete && updatedItems.some((item) => item.counted === null)) {
        window.alert("Hãy nhập số lượng thực đếm cho tất cả vật tư trước khi hoàn tất.");
        return;
      }
      const counted = updatedItems.filter((item) => item.counted !== null).length;
      const differenceCount = updatedItems.filter(
        (item) => item.counted !== null && item.counted !== item.expected,
      ).length;
      const updated = {
        ...activeBatch,
        items: updatedItems,
        sample: false,
        progress: `${counted} / ${updatedItems.length} mã`,
        difference: counted === 0 ? "—" : differenceCount === 0 ? "Không" : `${String(differenceCount).padStart(2, "0")} mã`,
        status: complete ? "Hoàn tất" : activeBatch.status,
      };
      const nextBatches = batches.filter((batch) => batch.number !== updated.number);
      nextBatches.push(updated);
      if (!write(KEYS.stocktakes, nextBatches)) return;
      batches.splice(0, batches.length, ...nextBatches);
      records.set(updated.number, updated);
      activeBatch = updated;
      const batchRow = [...tbody.rows].find((row) => row.cells[0].textContent.trim() === updated.number);
      if (batchRow) {
        batchRow.cells[4].textContent = updated.progress;
        batchRow.cells[5].textContent = updated.difference;
        const badge = batchRow.cells[6].querySelector(".status");
        badge.textContent = updated.status;
        badge.className = updated.status === "Hoàn tất" ? "status good" : "status low";
        if (updated.status === "Hoàn tất") {
          const action = batchRow.cells[7].querySelector("[data-action='count']");
          if (action) action.textContent = "Xem";
        }
      }
      renderItems(updated);
      if (!complete) window.alert(`Đã lưu tiến độ kiểm kê ${updated.number}.`);
      else window.alert(`Đợt kiểm kê ${updated.number} đã hoàn tất.`);
    };
    // Mở chi tiết một đợt kiểm kê; bổ sung danh sách vật tư cho đợt mẫu cũ.
    const openBatch = (batch) => {
      const demoCounts = {
        "KK-2026-004": {
          "VT-00124": 150,
          "VT-00087": 16,
          "VT-00056": 12,
          "VT-00102": 60,
          "VT-00031": 10,
        },
        "KK-2026-003": {
          "VT-00124": 147,
        },
        "KK-2026-002": {},
      };
      const sampleCounts = demoCounts[batch.number];
      if (!Array.isArray(batch.items) || !batch.items.length) {
        batch = {
          ...batch,
          sample: Boolean(sampleCounts),
          items: inventory.map((item) => ({
            code: item.code,
            name: item.name,
            unit: item.unit,
            expected: Number(item.quantity) || 0,
            counted: sampleCounts
              ? sampleCounts[item.code] ?? (Number(item.quantity) || 0)
              : null,
          })),
        };
      } else if (
        sampleCounts &&
        batch.items.every((item) => item.counted === null)
      ) {
        batch = {
          ...batch,
          sample: true,
          items: batch.items.map((item) => ({
            ...item,
            counted: sampleCounts[item.code] ?? item.expected,
          })),
        };
      }
      activeBatch = batch;
      renderItems(batch);
      detail.hidden = false;
      detail.scrollIntoView({ behavior: "smooth", block: "start" });
      if (batch.status !== "Hoàn tất") {
        const firstUncounted = [...itemBody.querySelectorAll(".stocktake-count-input")].find(
          (input) => input.value === "",
        );
        firstUncounted?.focus();
      }
    };
    tbody.addEventListener("click", (event) => {
      const button = event.target instanceof Element ? event.target.closest("[data-action='count']") : null;
      const row = button?.closest("tr");
      if (!row) return;
      const batch = records.get(row.cells[0].textContent.trim());
      if (batch) openBatch(batch);
    });
    itemBody.addEventListener("input", () => {
      if (activeBatch) {
        const inputs = [...itemBody.querySelectorAll(".stocktake-count-input")];
        inputs.forEach((input) => {
          const item = activeBatch.items.find((entry) => entry.code === input.dataset.itemCode);
          const diffCell = input.closest("tr").cells[4];
          const value = input.value.trim();
          if (!item || value === "") {
            diffCell.textContent = "Chưa đếm";
            return;
          }
          const difference = Number(value) - item.expected;
          diffCell.textContent = `${difference > 0 ? "+" : ""}${difference} ${item.unit}`;
        });
        completeButton.disabled = inputs.some((input) => input.value.trim() === "");
      }
    });
    document.querySelector("#save-stocktake-counts").addEventListener("click", () => saveCounts());
    completeButton.addEventListener("click", () => saveCounts(true));
    document.querySelector("#close-stocktake-detail").addEventListener("click", () => {
      detail.hidden = true;
      activeBatch = null;
    });
    document.querySelector("#export-stocktakes")?.addEventListener("click", () => {
      const rows = [...tbody.rows].map((row) =>
        [...row.cells].slice(0, 7).map((td) => td.textContent.trim()),
      );
      downloadCsv(
        "lich-su-kiem-ke.csv",
        ["Mã đợt", "Khu vực", "Ngày tạo", "Người phụ trách", "Tiến độ", "Chênh lệch", "Trạng thái"],
        rows,
      );
    });
    const dateInput = document.querySelector("#stocktake-date");
    if (dateInput) dateInput.value = todayIso();
    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      const values = new FormData(form);
      const numbers = [...tbody.rows].map((row) => row.cells[0].textContent.trim());
      const serial = numbers.reduce((max, value) => {
        return Math.max(max, Number(value.match(/(\d+)$/)?.[0] || 0));
      }, 0) + 1;
      const batch = {
        number: `KK-${new Date().getFullYear()}-${String(serial).padStart(3, "0")}`,
        area: String(values.get("area")).trim(),
        date: formatDate(String(values.get("date"))),
        manager: String(values.get("manager")).trim(),
        progress: `0 / ${inventory.length} mã`,
        difference: "—",
        status: "Đang thực hiện",
        items: inventory.map((item) => ({
          code: item.code,
          name: item.name,
          unit: item.unit,
          expected: Number(item.quantity) || 0,
          counted: null,
        })),
      };
      if (!write(KEYS.stocktakes, [...batches, batch])) return;
      batches.push(batch);
      renderBatch(batch);
      form.reset();
      dateInput.value = todayIso();
      panel.hidden = true;
      window.alert(`Đã tạo đợt kiểm kê ${batch.number}.`);
    });
    // Thêm hàng đợt kiểm kê vào bảng và đăng ký bản ghi để mở xem.
    function renderBatch(batch) {
      const row = document.createElement("tr");
      [
        batch.number,
        batch.area,
        batch.date,
        batch.manager,
        batch.progress,
        batch.difference,
      ].forEach((value) => cell(row, value));
      const status = cell(row, "");
      const badge = document.createElement("span");
      badge.className = batch.status === "Hoàn tất" ? "status good" : "status low";
      badge.textContent = batch.status;
      status.append(badge);
      const action = cell(row, "");
      const actionButton = document.createElement("button");
      actionButton.type = "button";
      actionButton.className = "button";
      actionButton.dataset.action = "count";
      actionButton.textContent = batch.status === "Hoàn tất" ? "Xem" : "Kiểm kê";
      action.append(actionButton);
      tbody.append(row);
      records.set(batch.number, batch);
    }
    // Bổ sung nút mở/kiểm kê cho các đợt mẫu đã có trong HTML.
    function addBatchAction(row) {
      if (row.cells.length >= 8) return;
      const action = cell(row, "");
      const actionButton = document.createElement("button");
      actionButton.type = "button";
      actionButton.className = "button";
      actionButton.dataset.action = "count";
      actionButton.textContent = row.cells[6].textContent.trim() === "Hoàn tất" ? "Xem" : "Kiểm kê";
      action.append(actionButton);
    }
    const voucherHistory = document.querySelector("#stocktake-voucher-history");
    if (voucherHistory) {
      const savedReceipts = read(KEYS.createdReceipts, []);
      const deletedReceipts = read(KEYS.deletedReceipts, []);
      const approvedReceipts = read(KEYS.approvedReceipts, {});
      const savedOutbound = read(KEYS.createdOutbound, []);
      const deletedOutbound = read(KEYS.deletedOutbound, []);
      const approvedOutbound = read(KEYS.approvedOutbound, {});
      if (
        !Array.isArray(savedReceipts) ||
        !Array.isArray(deletedReceipts) ||
        !Array.isArray(savedOutbound) ||
        !Array.isArray(deletedOutbound) ||
        !approvedReceipts ||
        typeof approvedReceipts !== "object" ||
        Array.isArray(approvedReceipts) ||
        !approvedOutbound ||
        typeof approvedOutbound !== "object" ||
        Array.isArray(approvedOutbound)
      ) {
        window.alert("Lịch sử phiếu nhập/xuất lưu trữ không hợp lệ.");
      }
      const receiptRecords = new Map([
        ["PN-2026-0084", {
          number: "PN-2026-0084",
          date: "29/09/2026",
          party: "Thiết bị điện Minh Phát",
          itemCount: "06",
          items: ["Dây điện Cadivi 2.5mm — 4 cuộn", "CB tép 2P 20A LS — 2 cái"],
          status: "Chờ xác nhận",
          sample: true,
        }],
        ["PN-2026-0083", {
          number: "PN-2026-0083",
          date: "28/09/2026",
          party: "Cơ khí Thành Công",
          itemCount: "12",
          items: ["Bu lông lục giác M10 x 50 — 200 cái", "Mũi khoan thép HSS 8mm — 12 cái"],
          status: "Hoàn tất",
          sample: true,
        }],
        ["PN-2026-0082", {
          number: "PN-2026-0082",
          date: "26/09/2026",
          party: "Bảo hộ An Toàn",
          itemCount: "04",
          items: ["Găng tay bảo hộ phủ PU — 30 đôi", "Mũ bảo hộ lao động — 10 cái"],
          status: "Hoàn tất",
          sample: true,
        }],
      ]);
      (Array.isArray(savedReceipts) ? savedReceipts : []).forEach((record) => {
        if (!Array.isArray(deletedReceipts) || !deletedReceipts.includes(record.number)) {
          receiptRecords.set(record.number, {
            ...record,
            party: record.supplier,
            status: approvedReceipts?.[record.number] ? "Hoàn tất" : record.status || "Chờ xác nhận",
          });
        }
      });
      if (Array.isArray(deletedReceipts)) {
        deletedReceipts.forEach((number) => receiptRecords.delete(number));
      }
      const outboundRecords = new Map([
        ["PX-2026-0117", {
          number: "PX-2026-0117",
          date: "29/09/2026",
          party: "Sản xuất",
          itemCount: "05",
          items: ["Dây điện Cadivi 2.5mm — 3 cuộn", "Băng keo cách điện Nano — 8 cuộn"],
          status: "Chờ duyệt",
          sample: true,
        }],
        ["PX-2026-0116", {
          number: "PX-2026-0116",
          date: "29/09/2026",
          party: "Bảo trì",
          itemCount: "03",
          items: ["Găng tay bảo hộ phủ PU — 5 đôi", "Mũi khoan thép HSS 8mm — 2 cái"],
          status: "Đã xuất",
          sample: true,
        }],
        ["PX-2026-0115", {
          number: "PX-2026-0115",
          date: "28/09/2026",
          party: "Sản xuất",
          itemCount: "08",
          items: ["Bu lông lục giác M10 x 50 — 40 cái", "CB tép 2P 20A LS — 2 cái"],
          status: "Đã xuất",
          sample: true,
        }],
      ]);
      (Array.isArray(savedOutbound) ? savedOutbound : []).forEach((record) => {
        if (!Array.isArray(deletedOutbound) || !deletedOutbound.includes(record.number)) {
          outboundRecords.set(record.number, {
            ...record,
            party: record.department,
            status: approvedOutbound?.[record.number] ? "Đã duyệt" : record.status || "Chờ duyệt",
          });
        }
      });
      if (Array.isArray(deletedOutbound)) {
        deletedOutbound.forEach((number) => outboundRecords.delete(number));
      }
      // Thêm một phiếu nhập/xuất cùng chi tiết vật tư vào bảng lịch sử kiểm kê.
      const renderVoucher = (type, record) => {
        const row = document.createElement("tr");
        cell(row, type);
        cell(row, record.number);
        cell(row, record.date);
        cell(row, record.party || "—");
        const itemsCell = cell(row, "");
        const itemLabel = document.createElement("div");
        itemLabel.className = "voucher-item-count";
        itemLabel.textContent = `${record.itemCount || "0"} mặt hàng`;
        itemsCell.append(itemLabel);
        if (record.sample) {
          const sampleNote = document.createElement("div");
          sampleNote.className = "document-items-note";
          sampleNote.textContent = "Chi tiết minh họa";
          itemsCell.append(sampleNote);
        }
        if (Array.isArray(record.items) && record.items.length > 0) {
          const list = document.createElement("ul");
          list.className = "voucher-items-list";
          record.items.forEach((item) => {
            const entry = document.createElement("li");
            entry.textContent = item;
            list.append(entry);
          });
          itemsCell.append(list);
        } else {
          const missing = document.createElement("span");
          missing.className = "form-note";
          missing.textContent = "Chưa lưu chi tiết mặt hàng";
          itemsCell.append(missing);
        }
        const statusCell = cell(row, "");
        const badge = document.createElement("span");
        badge.className = ["Hoàn tất", "Đã xuất", "Đã duyệt"].includes(record.status)
          ? "status good"
          : "status low";
        badge.textContent = record.status || "—";
        statusCell.append(badge);
        voucherHistory.append(row);
      };
      [...outboundRecords.values()].reverse().forEach((record) => renderVoucher("Phiếu xuất", record));
      [...receiptRecords.values()].reverse().forEach((record) => renderVoucher("Phiếu nhập", record));
    }
  };

  // Quản lý tạo, duyệt, xem chi tiết và xóa phiếu nhập kho.
  const setupReceiptHistory = (session) => {
    const form = document.querySelector("#receipt-form");
    const tbody = document.querySelector("#receipt-history");
    if (!form || !tbody) return;
    const createdKey = KEYS.createdReceipts;
    const deletedKey = KEYS.deletedReceipts;
    const created = read(createdKey, []);
    const deletedValues = read(deletedKey, []);
    const approved = read(KEYS.approvedReceipts, {});
    if (
      !Array.isArray(created) ||
      !Array.isArray(deletedValues) ||
      !approved ||
      typeof approved !== "object" ||
      Array.isArray(approved)
    ) {
      window.alert("Lịch sử phiếu nhập lưu trữ không hợp lệ.");
      return;
    }
    const deleted = new Set(deletedValues);
    const recordsByNumber = new Map(created.map((record) => [record.number, record]));
    [
      ["PN-2026-0084", ["Dây điện Cadivi 2.5mm — 4 cuộn", "CB tép 2P 20A LS — 2 cái"]],
      ["PN-2026-0083", ["Bu lông lục giác M10 x 50 — 200 cái", "Mũi khoan thép HSS 8mm — 12 cái"]],
      ["PN-2026-0082", ["Găng tay bảo hộ phủ PU — 30 đôi", "Mũ bảo hộ lao động — 10 cái"]],
    ].forEach(([number, items]) => {
      if (!recordsByNumber.has(number)) {
        recordsByNumber.set(number, { items, sample: true });
      }
    });
    [...tbody.rows].forEach((row) => {
      if (deleted.has(row.dataset.documentId)) row.remove();
    });
    // Thêm nút mở/ẩn danh sách vật tư cho một phiếu nhập.
    const addItemsButton = (row) => {
      const actions = row.cells[8];
      if (!actions || actions.querySelector('[data-action="view-items"]')) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "button";
      button.dataset.action = "view-items";
      button.textContent = "Xem hàng";
      const wrap = actions.querySelector(".row-actions") || actions;
      wrap.prepend(button);
    };
    // Mở hoặc thu gọn danh sách mặt hàng đã lưu của phiếu nhập.
    const toggleItems = (row, number) => {
      const existing = row.nextElementSibling;
      if (existing?.classList.contains("document-items-detail")) {
        existing.remove();
        row.querySelector('[data-action="view-items"]').textContent = "Xem hàng";
        return;
      }
      const detailRow = document.createElement("tr");
      detailRow.className = "document-items-detail";
      const detailCell = cell(detailRow, "");
      detailCell.colSpan = 9;
      const record = recordsByNumber.get(number);
      if (record?.sample) {
        const note = document.createElement("p");
        note.className = "document-items-note";
        note.textContent = "Chi tiết minh họa · Dữ liệu mẫu";
        detailCell.append(note);
      }
      if (Array.isArray(record?.items) && record.items.length > 0) {
        const list = document.createElement("ol");
        record.items.forEach((item) => {
          const entry = document.createElement("li");
          entry.textContent = item;
          list.append(entry);
        });
        detailCell.append(list);
      } else {
        detailCell.textContent = "Phiếu này chưa có chi tiết mặt hàng được lưu.";
      }
      row.after(detailRow);
      row.querySelector('[data-action="view-items"]').textContent = "Ẩn hàng";
    };
    // Lưu người duyệt và cập nhật trạng thái phiếu nhập thành hoàn tất.
    const approveRecord = (row, approver) => {
      const number = row.dataset.documentId;
      if (!number || row.cells[7]?.textContent.trim() !== "Chờ xác nhận") return;
      const nextApproved = { ...approved, [number]: approver };
      if (!write(KEYS.approvedReceipts, nextApproved)) return;
      Object.assign(approved, nextApproved);
      row.cells[6].textContent = approver;
      const badge = row.cells[7].querySelector(".status");
      badge.className = "status good";
      badge.textContent = "Hoàn tất";
      row.querySelector('[data-action="approve"]')?.remove();
    };
    // Thêm nút duyệt cho các phiếu nhập đang chờ xác nhận.
    const addApproveButton = (row) => {
      if (!row.cells[7] || row.cells[7].textContent.trim() !== "Chờ xác nhận") return;
      const actions = row.cells[8];
      if (!actions) return;
      const wrap = actions.querySelector(".row-actions") || actions;
      if (wrap.querySelector('[data-action="approve"]')) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "button primary";
      button.dataset.action = "approve";
      button.textContent = "Duyệt";
      wrap.prepend(button);
    };
    [...tbody.rows].forEach((row) => {
      const number = row.dataset.documentId;
      if (approved[number]) {
        row.cells[6].textContent = approved[number];
        const badge = row.cells[7].querySelector(".status");
        if (badge) {
          badge.className = "status good";
          badge.textContent = "Hoàn tất";
        }
        row.querySelector('[data-action="approve"]')?.remove();
      }
      addApproveButton(row);
    });
    // Tạo hàng lịch sử từ dữ liệu phiếu nhập và gắn các nút thao tác.
    const render = (record) => {
      const row = document.createElement("tr");
      row.dataset.documentId = record.number;
      [
        record.number,
        record.date,
        record.supplier,
        record.itemCount,
        record.value,
        record.creator,
      ].forEach((value) => cell(row, value));
      cell(row, approved[record.number] || "—");
      const status = cell(row, "");
      const badge = document.createElement("span");
      const statusText = approved[record.number] ? "Hoàn tất" : record.status || "Chờ xác nhận";
      badge.className = statusText === "Chờ xác nhận" ? "status low" : "status good";
      badge.textContent = statusText;
      status.append(badge);
      const action = cell(row, "");
      const actions = document.createElement("div");
      actions.className = "row-actions";
      action.append(actions);
      const deleteButton = document.createElement("button");
      deleteButton.className = "button button-danger";
      deleteButton.type = "button";
      deleteButton.dataset.action = "delete";
      deleteButton.textContent = "Xóa";
      actions.append(deleteButton);
      tbody.append(row);
      addItemsButton(row);
      addApproveButton(row);
    };
    [...tbody.rows].forEach(addItemsButton);
    created.forEach((record) => {
      if (!deleted.has(record.number)) {
        render(record);
        recordsByNumber.set(record.number, record);
      }
    });
    const numberInput = document.querySelector("#receipt-number");
    // Tính số phiếu nhập kế tiếp dựa trên số lớn nhất đang có.
    const nextNumber = () => {
      const numbers = [...tbody.rows].map((row) => row.dataset.documentId);
      const highest = [...numbers, ...deleted].reduce((max, value) => {
        return Math.max(max, Number(value.match(/(\d+)$/)?.[0] || 0));
      }, 84);
      return `PN-${new Date().getFullYear()}-${String(highest + 1).padStart(4, "0")}`;
    };
    numberInput.value = nextNumber();
    const dateInput = document.querySelector("#receipt-date");
    if (dateInput) dateInput.value = todayIso();
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const values = new FormData(form);
      const number = String(values.get("number"));
      const lines = String(values.get("items")).split(/\r?\n/).filter((line) => line.trim());
      const record = {
        number,
        date: formatDate(String(values.get("date"))),
        supplier: String(values.get("supplier")),
        itemCount: String(lines.length).padStart(2, "0"),
        items: lines.map((line) => line.trim()),
        value: `${new Intl.NumberFormat("vi-VN").format(Number(values.get("value")))} đ`,
        creator: session.name || session.username,
        status: "Chờ xác nhận",
      };
      if (!write(createdKey, [...created, record])) return;
      created.push(record);
      recordsByNumber.set(record.number, record);
      render(record);
      form.reset();
      dateInput.value = todayIso();
      numberInput.value = nextNumber();
      window.alert(`Đã lưu phiếu nhập ${number}.`);
    });
    tbody.addEventListener("click", (event) => {
      const button = event.target instanceof Element ? event.target.closest("[data-action]") : null;
      const row = button?.closest("tr");
      const number = row?.dataset.documentId;
      if (!button || !row || !number) return;
      if (button.dataset.action === "view-items") {
        toggleItems(row, number);
        return;
      }
      if (button.dataset.action === "approve") {
        approveRecord(row, session.name || session.username);
        return;
      }
      if (button.dataset.action !== "delete" || !window.confirm(`Xóa phiếu nhập ${number}?`)) return;
      if (!write(deletedKey, [...deleted, number])) return;
      deleted.add(number);
      if (row.nextElementSibling?.classList.contains("document-items-detail")) {
        row.nextElementSibling.remove();
      }
      row.remove();
    });
    document.querySelector("#export-receipt-history")?.addEventListener("click", () => {
      downloadCsv(
        "lich-su-phieu-nhap.csv",
        ["Số phiếu", "Ngày nhập", "Nhà cung cấp", "Mặt hàng", "Giá trị", "Người tạo", "Người duyệt", "Trạng thái"],
        [...tbody.rows].map((row) => [...row.cells].slice(0, 8).map((td) => td.textContent.trim())),
      );
    });
  };

  // Quản lý tạo, duyệt, xem chi tiết, xuất CSV và xóa phiếu xuất kho.
  const setupOutboundHistory = (session) => {
    const form = document.querySelector("#outbound-form");
    const tbody = document.querySelector("#outbound-history");
    if (!form || !tbody) return;
    const created = read(KEYS.createdOutbound, []);
    const deletedValues = read(KEYS.deletedOutbound, []);
    const approved = read(KEYS.approvedOutbound, {});
    if (
      !Array.isArray(created) ||
      !Array.isArray(deletedValues) ||
      !approved ||
      typeof approved !== "object" ||
      Array.isArray(approved)
    ) {
      window.alert("Lịch sử phiếu xuất lưu trữ không hợp lệ.");
      return;
    }
    const deleted = new Set(deletedValues);
    const recordsByNumber = new Map(created.map((record) => [record.number, record]));
    [
      ["PX-2026-0117", ["Dây điện Cadivi 2.5mm — 3 cuộn", "Băng keo cách điện Nano — 8 cuộn"]],
      ["PX-2026-0116", ["Găng tay bảo hộ phủ PU — 5 đôi", "Mũi khoan thép HSS 8mm — 2 cái"]],
      ["PX-2026-0115", ["Bu lông lục giác M10 x 50 — 40 cái", "CB tép 2P 20A LS — 2 cái"]],
    ].forEach(([number, items]) => {
      if (!recordsByNumber.has(number)) {
        recordsByNumber.set(number, { items, sample: true });
      }
    });
    [...tbody.rows].forEach((row) => {
      if (deleted.has(row.dataset.documentId)) row.remove();
    });
    const headers = [
      "Số phiếu",
      "Ngày xuất",
      "Bộ phận nhận",
      "Số mặt hàng",
      "Người yêu cầu",
      "Người duyệt",
      "Trạng thái",
    ];
    // Thêm nút mở/ẩn danh sách vật tư cho một phiếu xuất.
    const addItemsButton = (row) => {
      const actions = row.cells[7];
      if (!actions || actions.querySelector('[data-action="view-items"]')) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "button";
      button.dataset.action = "view-items";
      button.textContent = "Xem hàng";
      const wrap = actions.querySelector(".row-actions") || actions;
      wrap.prepend(button);
    };
    // Mở hoặc thu gọn danh sách mặt hàng đã lưu của phiếu xuất.
    const toggleItems = (row, number) => {
      const existing = row.nextElementSibling;
      if (existing?.classList.contains("document-items-detail")) {
        existing.remove();
        row.querySelector('[data-action="view-items"]').textContent = "Xem hàng";
        return;
      }
      const detailRow = document.createElement("tr");
      detailRow.className = "document-items-detail";
      const detailCell = cell(detailRow, "");
      detailCell.colSpan = 8;
      const record = recordsByNumber.get(number);
      if (record?.sample) {
        const note = document.createElement("p");
        note.className = "document-items-note";
        note.textContent = "Chi tiết minh họa · Dữ liệu mẫu";
        detailCell.append(note);
      }
      if (Array.isArray(record?.items) && record.items.length > 0) {
        const list = document.createElement("ol");
        record.items.forEach((item) => {
          const entry = document.createElement("li");
          entry.textContent = item;
          list.append(entry);
        });
        detailCell.append(list);
      } else {
        detailCell.textContent = "Phiếu này chưa có chi tiết mặt hàng được lưu.";
      }
      row.after(detailRow);
      row.querySelector('[data-action="view-items"]').textContent = "Ẩn hàng";
    };
    // Lưu người duyệt và cập nhật trạng thái phiếu xuất.
    const approveRecord = (row, approver) => {
      const number = row.dataset.documentId;
      if (!number || row.cells[6]?.textContent.trim() !== "Chờ duyệt") return;
      const nextApproved = { ...approved, [number]: approver };
      if (!write(KEYS.approvedOutbound, nextApproved)) return;
      Object.assign(approved, nextApproved);
      row.cells[5].textContent = approver;
      const badge = row.cells[6].querySelector(".status");
      badge.className = "status good";
      badge.textContent = "Đã duyệt";
      row.querySelector('[data-action="approve"]')?.remove();
    };
    // Thêm nút duyệt cho các phiếu xuất đang chờ duyệt.
    const addApproveButton = (row) => {
      const actions = row.cells[7];
      if (!actions || row.cells[6]?.textContent.trim() !== "Chờ duyệt") return;
      const wrap = actions.querySelector(".row-actions") || actions;
      if (wrap.querySelector('[data-action="approve"]')) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "button primary";
      button.dataset.action = "approve";
      button.textContent = "Duyệt";
      wrap.prepend(button);
    };
    [...tbody.rows].forEach((row) => {
      const number = row.dataset.documentId;
      if (approved[number]) {
        row.cells[5].textContent = approved[number];
        const badge = row.cells[6].querySelector(".status");
        if (badge) {
          badge.className = "status good";
          badge.textContent = "Đã duyệt";
        }
      }
      addApproveButton(row);
    });
    // Tạo hàng lịch sử từ dữ liệu phiếu xuất và gắn các nút thao tác.
    const render = (record) => {
      const row = document.createElement("tr");
      row.dataset.documentId = record.number;
      [
        record.number,
        record.date,
        record.department,
        record.itemCount,
        record.requester,
        approved[record.number] || record.approver,
      ].forEach((value) => cell(row, value));
      const status = cell(row, "");
      const badge = document.createElement("span");
      const statusText = approved[record.number] ? "Đã duyệt" : record.status || "Chờ duyệt";
      badge.className = statusText === "Chờ duyệt" ? "status low" : "status good";
      badge.textContent = statusText;
      status.append(badge);
      const actions = cell(row, "");
      const wrap = document.createElement("div");
      wrap.className = "row-actions";
      [["delete", "Xóa", "button button-danger"], ["export-record", "Xuất", "button"]].forEach(
        ([action, label, className]) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = className;
          button.dataset.action = action;
          button.textContent = label;
          wrap.append(button);
        },
      );
      actions.append(wrap);
      tbody.append(row);
      addItemsButton(row);
      addApproveButton(row);
    };
    [...tbody.rows].forEach(addItemsButton);
    created.forEach((record) => {
      if (!deleted.has(record.number)) {
        render(record);
        recordsByNumber.set(record.number, record);
      }
    });
    const numberInput = document.querySelector("#issue-number");
    // Tính số phiếu xuất kế tiếp dựa trên số lớn nhất đang có.
    const nextNumber = () => {
      const numbers = [...tbody.rows].map((row) => row.dataset.documentId);
      const highest = [...numbers, ...deleted].reduce((max, value) => {
        return Math.max(max, Number(value.match(/(\d+)$/)?.[0] || 0));
      }, 0);
      return `PX-${new Date().getFullYear()}-${String(highest + 1).padStart(4, "0")}`;
    };
    numberInput.value = nextNumber();
    const dateInput = document.querySelector("#issue-date");
    if (dateInput) dateInput.value = todayIso();
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const values = new FormData(form);
      const lines = String(values.get("items")).split(/\r?\n/).filter((line) => line.trim());
      const record = {
        number: String(values.get("number")),
        date: formatDate(String(values.get("date"))),
        department: String(values.get("department")),
        itemCount: String(lines.length).padStart(2, "0"),
        items: lines.map((line) => line.trim()),
        requester: String(values.get("requester")).trim(),
        approver: String(values.get("approver")) || session.name || session.username,
        status: "Chờ duyệt",
      };
      if (!write(KEYS.createdOutbound, [...created, record])) return;
      created.push(record);
      recordsByNumber.set(record.number, record);
      render(record);
      form.reset();
      dateInput.value = todayIso();
      numberInput.value = nextNumber();
      window.alert(`Đã lưu phiếu xuất ${record.number}.`);
    });
    tbody.addEventListener("click", (event) => {
      const button = event.target instanceof Element ? event.target.closest("[data-action]") : null;
      const row = button?.closest("tr");
      const number = row?.dataset.documentId;
      if (!button || !row || !number) return;
      const rowData = [...row.cells].slice(0, headers.length).map((td) => td.textContent.trim());
      if (button.dataset.action === "view-items") {
        toggleItems(row, number);
        return;
      }
      if (button.dataset.action === "approve") {
        approveRecord(row, session.name || session.username);
        return;
      }
      if (button.dataset.action === "export-record") {
        downloadCsv(`${number}.csv`, headers, [rowData]);
        return;
      }
      if (!window.confirm(`Bạn có chắc muốn xóa phiếu ${number}?`)) return;
      if (!write(KEYS.deletedOutbound, [...deleted, number])) return;
      deleted.add(number);
      if (row.nextElementSibling?.classList.contains("document-items-detail")) {
        row.nextElementSibling.remove();
      }
      row.remove();
    });
    document.querySelector("#export-history")?.addEventListener("click", () => {
      downloadCsv(
        "lich-su-phieu-xuat.csv",
        headers,
        [...tbody.rows].map((row) => [...row.cells].slice(0, headers.length).map((td) => td.textContent.trim())),
      );
    });
  };

  // Chạy các phần khởi tạo phù hợp sau khi HTML tải xong.
  document.addEventListener("DOMContentLoaded", () => {
    if (initializeLogin()) return;
    const session = guardSession();
    if (!session) return;
    // Đồng bộ tên kho trên phiếu trước khi mở hộp thoại in chứng từ.
    document.querySelectorAll('[data-action="print-document"]').forEach((button) => {
      button.addEventListener("click", () => {
        const panel = button.closest(".transaction-form");
        const warehouse = panel?.querySelector('select[name="warehouse"]');
        const warehouseLabel = panel?.querySelector(".document-warehouse");
        if (warehouse && warehouseLabel) {
          warehouseLabel.textContent = warehouse.selectedOptions[0]?.textContent || "";
        }
        window.print();
      });
    });
    setupHeader(session);
    const today = document.querySelector("#today");
    if (today) today.textContent = new Intl.DateTimeFormat("vi-VN", { dateStyle: "full" }).format(new Date());
    setupInventory();
    setupWarehouses();
    setupSuppliers();
    setupStocktakes();
    setupReceiptHistory(session);
    setupOutboundHistory(session);
  });
})();
