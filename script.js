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

  const cell = (row, value) => {
    const td = document.createElement("td");
    td.textContent = String(value ?? "");
    row.append(td);
    return td;
  };

  const formatDate = (date) => {
    if (!date) return "";
    const [year, month, day] = date.split("-");
    return year && month && day ? `${day}/${month}/${year}` : date;
  };

  const todayIso = () => new Date().toISOString().slice(0, 10);

  const downloadCsv = (fileName, headers, rows) => {
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

  const guardSession = () => {
    const session = read(KEYS.session, null);
    if (!session?.username) {
      window.location.replace("login.html");
      return null;
    }
    return session;
  };

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

  const setupInventory = () => {
    const tbody = document.querySelector("#inventory-list");
    if (!tbody) return;
    const items = read(KEYS.inventory, parseInventoryRows(tbody));
    if (!Array.isArray(items)) {
      window.alert("Danh mục vật tư lưu trữ không hợp lệ.");
      return;
    }
    const statusFor = (item) =>
      item.quantity <= 0
        ? ["Hết hàng", "empty"]
        : item.quantity < item.minimum
          ? ["Sắp hết", "low"]
          : ["Còn hàng", "good"];
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

  const setupSuppliers = () => {
    const tbody = document.querySelector("#supplier-list");
    const form = document.querySelector("#supplier-form");
    const supplierSelect = document.querySelector("#receipt-supplier");
    let suppliers;
    if (tbody) {
      const seeded = [...tbody.rows].map((row) => ({
        code: row.cells[0].textContent.trim(),
        name: row.cells[1].textContent.trim(),
        group: row.cells[2].textContent.trim(),
        contact: row.cells[3].textContent.trim(),
        phone: row.cells[4].textContent.trim(),
        receipts: row.cells[5].textContent.trim(),
        status: row.cells[6].textContent.trim(),
      }));
      suppliers = read(KEYS.suppliers, seeded);
      if (!Array.isArray(suppliers)) {
        window.alert("Danh sách nhà cung cấp lưu trữ không hợp lệ.");
        suppliers = seeded;
      }
      const render = () => {
        tbody.replaceChildren();
        suppliers.forEach((supplier) => {
          const row = document.createElement("tr");
          [
            supplier.code,
            supplier.name,
            supplier.group,
            supplier.contact,
            supplier.phone,
            supplier.receipts || "0",
          ].forEach((value) => cell(row, value));
          const status = cell(row, "");
          const badge = document.createElement("span");
          badge.className = "status good";
          badge.textContent = supplier.status || "Đang hợp tác";
          status.append(badge);
          tbody.append(row);
        });
      };
      render();
      form?.addEventListener("submit", (event) => {
        event.preventDefault();
        const values = new FormData(form);
        const name = String(values.get("name")).trim();
        if (suppliers.some((supplier) => supplier.name.toLowerCase() === name.toLowerCase())) {
          window.alert("Nhà cung cấp này đã có trong danh sách.");
          return;
        }
        const maxCode = suppliers.reduce((max, supplier) => {
          return Math.max(max, Number(supplier.code.match(/\d+$/)?.[0] || 0));
        }, 0);
        const supplier = {
          code: `NCC-${String(maxCode + 1).padStart(3, "0")}`,
          name,
          group: String(values.get("group")).trim(),
          contact: String(values.get("contact")).trim(),
          phone: String(values.get("phone")).trim(),
          email: String(values.get("email")).trim(),
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
      document.querySelector("#stocktake-detail-note").textContent = isReadOnly
        ? hasSavedCounts
          ? "Đợt đã hoàn tất; thông tin kiểm đếm được mở ở chế độ chỉ xem."
          : "Đợt mẫu này được tạo trước khi lưu số đếm chi tiết; danh sách vật tư chỉ để tham khảo."
        : "Nhập số lượng thực tế cho từng vật tư. Có thể lưu tiến độ và tiếp tục sau.";
      document.querySelector("#stocktake-detail-actions").hidden = isReadOnly;
      completeButton.disabled = !batch.items.length || batch.items.some((item) => item.counted === null);
    };
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
    const openBatch = (batch) => {
      if (!Array.isArray(batch.items) || !batch.items.length) {
        batch = {
          ...batch,
          items: inventory.map((item) => ({
            code: item.code,
            name: item.name,
            unit: item.unit,
            expected: Number(item.quantity) || 0,
            counted: null,
          })),
        };
      }
      activeBatch = batch;
      renderItems(batch);
      detail.hidden = false;
      detail.scrollIntoView({ behavior: "smooth", block: "start" });
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
        completeButton.disabled = [...itemBody.querySelectorAll(".stocktake-count-input")].some(
          (input) => input.value.trim() === "",
        );
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
  };

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
    [...tbody.rows].forEach((row) => {
      if (deleted.has(row.dataset.documentId)) row.remove();
    });
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
      addApproveButton(row);
    };
    created.forEach((record) => {
      if (!deleted.has(record.number)) render(record);
    });
    const numberInput = document.querySelector("#receipt-number");
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
        value: `${new Intl.NumberFormat("vi-VN").format(Number(values.get("value")))} đ`,
        creator: session.name || session.username,
        status: "Chờ xác nhận",
      };
      if (!write(createdKey, [...created, record])) return;
      created.push(record);
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
      if (button.dataset.action === "approve") {
        approveRecord(row, session.name || session.username);
        return;
      }
      if (button.dataset.action !== "delete" || !window.confirm(`Xóa phiếu nhập ${number}?`)) return;
      if (!write(deletedKey, [...deleted, number])) return;
      deleted.add(number);
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
      addApproveButton(row);
    };
    created.forEach((record) => {
      if (!deleted.has(record.number)) render(record);
    });
    const numberInput = document.querySelector("#issue-number");
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
        requester: String(values.get("requester")).trim(),
        approver: String(values.get("approver")) || session.name || session.username,
        status: "Chờ duyệt",
      };
      if (!write(KEYS.createdOutbound, [...created, record])) return;
      created.push(record);
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

  document.addEventListener("DOMContentLoaded", () => {
    if (initializeLogin()) return;
    const session = guardSession();
    if (!session) return;
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
