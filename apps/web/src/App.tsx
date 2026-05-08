import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type ActiveSection =
  | "dashboard"
  | "users"
  | "clients"
  | "categories"
  | "products"
  | "suppliers"
  | "warehouses"
  | "inventory"
  | "inventory-entry"
  | "orders"
  | "routes"
  | "catalog"
  | "imports"
  | "import-billing"
  | "accounting"
  | "logistics-accounting";

type KpiCard = {
  label: string;
  value: number;
  tone: "cyan" | "amber" | "slate";
};

type DashboardProductSalesRow = {
  productId: string;
  productName: string;
  productSku: string;
  totalUnits: number;
};

type DashboardClientBillingRow = {
  clientName: string;
  invoiceCount: number;
  totalRevenue: number;
};

type DashboardExecutiveCard = {
  label: string;
  valueLabel: string;
  tone: "cyan" | "amber" | "slate";
  targetSection?: ActiveSection;
};

type CreationStatus = {
  tone: "success" | "error";
  message: string;
};

type SectionFilters = {
  search: string;
  primary: string;
  secondary: string;
};

type CreationFilterDefinition = {
  key: string;
  label: string;
  placeholder: string;
};

type ProductImageState = {
  previewUrl: string;
  uploadedUrl: string;
  isUploading: boolean;
  error: string;
};

type FieldConfig = {
  name: string;
  label: string;
  type: "text" | "email" | "password" | "number" | "select" | "group-title" | "file" | "date";
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  width?: "full" | "third" | "two-third";
};

type CollectionConfig = {
  key: string;
  title: string;
  description: string;
  endpoint: string;
  fields: FieldConfig[];
  tableColumns: Array<{ key: string; label: string }>;
};

type CategoryOption = {
  value: string;
  label: string;
};

type SupplierOption = {
  value: string;
  label: string;
};

type SalesRepOption = {
  value: string;
  label: string;
};

type StoreOption = {
  value: string;
  label: string;
  address: string;
  code: string;
  email: string;
  phone: string;
  managerName: string;
  assignedProductIds: string[];
};

type ClientProductDraft = {
  productIds: string[];
};

type WarehouseOption = {
  value: string;
  label: string;
  code: string;
  address: string;
};

type ProductOption = {
  value: string;
  label: string;
  sku: string;
  salePrice: number;
  productWeightKg: number;
  variableSalePrice: boolean;
  unitsPerBox: number;
  unitsPerBoxUnit: string;
  boxLengthCm: number;
  boxWidthCm: number;
  boxHeightCm: number;
};

type CatalogRecord = {
  _id?: string;
  code: string;
  name: string;
  description: string;
  categoryNames: string[];
  productIds: string[];
  availableForOrders?: boolean;
  active?: boolean;
};

type CatalogPreviewItem = {
  productId: string;
  name: string;
  sku: string;
  category: string;
  imageUrl?: string;
  cost: number;
  salePrice: number;
};

type CatalogClientPricingRecord = {
  _id?: string;
  clientId: string;
  clientName: string;
  markupPercent: number;
  items: Array<{
    productId: string;
    productName: string;
    productSku: string;
    cost: number;
    salePrice: number;
  }>;
};

type CatalogPreviewResponse = {
  catalog: CatalogRecord;
  clientPricing?: CatalogClientPricingRecord | null;
  items: CatalogPreviewItem[];
};

type CatalogFormState = {
  name: string;
  description: string;
  categoryNames: string[];
  productIds: string[];
};

type CatalogWhatsappDraftAttachment = {
  file: File;
  generatedAtLabel: string;
};

type InventorySummaryRow = {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  salePrice: number;
  totalSale: number;
  unitCostBreakdown: {
    containerReference: string;
    shipmentReference: string;
    importDate: string;
    importQuantity: number;
    purchaseUnitCost: number;
    expenseRows: Array<{
      id: string;
      label: string;
      totalAmount: number;
      unitAmount: number;
    }>;
    totalUnitCost: number;
  } | null;
  expirationDate: string | null;
  isExpiringSoon: boolean;
};

type InventorySummaryResponse = {
  rows: InventorySummaryRow[];
  kpis: {
    totalProducts: number;
    totalUnits: number;
    totalInventoryCost: number;
    expiringSoon: number;
  };
  history: InventoryHistoryRow[];
};

type InventoryHistoryRow = {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  reason: string;
  notes: string;
  source: string;
  movementType: "entry" | "output";
  entryGroupId: string;
  entryWarehouseId: string;
  entryWarehouseName: string;
  entryUsdToAwgRate: number;
  entryCostUsd: number;
  createdAt: string;
};

type InventoryEntryHistoryGroup = {
  id: string;
  createdAt: string;
  warehouseId: string;
  warehouseName: string;
  usdToAwgRate: number;
  items: InventoryHistoryRow[];
  productCount: number;
  totalUnits: number;
};

type InventoryAdjustmentFormState = {
  quantity: string;
  reason: string;
  notes: string;
};

type InventoryEntryDraftItem = {
  id: string;
  productId: string;
  quantity: string;
  costUsd: string;
  salePriceAwg: string;
  expirationDate: string;
  productWeightKg: string;
};

type ContainerImportProductFormState = {
  productId: string;
  selected: boolean;
  boxCount: string;
  importedQuantity: string;
  purchaseUnitCostOrigin: string;
  purchaseBoxCostOrigin: string;
};

type ContainerType = "refrigerado" | "seco";

type ContainerMeasurementUnit = "m3" | "pie3" | "kg";

type ImportExpenseDocument = {
  name: string;
  url: string;
};

type ImportExpenseItemFormState = {
  id: string;
  key: "freight" | "customs" | "inlandLogistics" | "taxes" | "other";
  label: string;
  amount: string;
  documents: ImportExpenseDocument[];
  isUploading: boolean;
  error: string;
  saved: boolean;
};

type ContainerImportFormState = {
  containerType: ContainerType;
  containerSize: "20ft" | "40ft";
  measurementUnit: ContainerMeasurementUnit;
  importDate: string;
  shipmentReference: string;
  expenseItems: ImportExpenseItemFormState[];
  notes: string;
  products: ContainerImportProductFormState[];
};

type ImportContainerTemplateRecord = {
  id: string;
  name: string;
  containerType: ContainerType;
  containerSize: "20ft" | "40ft";
  measurementUnit: ContainerMeasurementUnit;
  notes: string;
  expenseItems: Array<{
    key: ImportExpenseItemFormState["key"];
    label: string;
    amount: number;
    documents: ImportExpenseDocument[];
  }>;
  products: ContainerImportProductFormState[];
  updatedAt: string;
};

type WarehouseLocationRecord = {
  _id?: string;
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  productId: string;
  productName: string;
  productSku: string;
  shelf: string;
  floor: string;
  rack: string;
  active?: boolean;
};

type WarehouseLocationFormState = {
  productId: string;
  shelf: string;
  floor: string;
  rack: string;
};

type RouteDayKey =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

type RouteStoreAssignment = {
  storeId: string;
  storeName: string;
  address: string;
};

type RouteDayAssignment = {
  day: RouteDayKey;
  stores: RouteStoreAssignment[];
};

type SalesRouteRecord = {
  _id?: string;
  code: string;
  name: string;
  salesRepId: string;
  salesRepName: string;
  weekStart: string;
  weekLabel: string;
  days: RouteDayAssignment[];
  assignedDays: number;
  plannedStops: number;
  notes?: string;
  active?: boolean;
};

type RouteFormState = {
  name: string;
  salesRepId: string;
  weekStart: string;
  notes: string;
  dayAssignments: Record<RouteDayKey, string[]>;
};

type SellerClientProduct = {
  productId: string;
  sku: string;
  name: string;
  category: string;
  imageUrl: string;
  salePrice: number;
};

type SellerAssignedStoreResponse = {
  store: {
    id: string;
    name: string;
    address: string;
    managerName: string;
  };
  products: SellerClientProduct[];
};

type SellerActiveSection = "routes" | "orders";

type SellerOrderDraft = Record<string, { stockCurrent: string; quantity: string; notes: string }>;

type SellerOrderRecord = {
  _id: string;
  routeId: string;
  routeName: string;
  routeDay: string;
  storeId: string;
  storeName: string;
  salesRepId: string;
  salesRepName: string;
  deliveryZone: string;
  status: "draft" | "submitted" | "picking" | "dispatched" | "delivered";
  createdAt: string;
  updatedAt: string;
  items: Array<{
    productId: string;
    stockCurrent: number | null;
    quantity: number;
    notes: string;
    productName: string;
    productSku: string;
  }>;
};

type SellerOrderEditDraft = Record<string, string>;

type WarehouseActiveSection = "inventory" | "orders";

type AccountingModalKind = "fixed-cost" | "operational-expense";

type AccountingView = "overview" | "container-import";

type ImportCostRecord = {
  _id?: string;
  containerReference?: string;
  containerType?: ContainerType;
  containerSize?: string;
  measurementUnit?: ContainerMeasurementUnit;
  shipmentReference?: string;
  expenseItems?: Array<{
    key: string;
    label: string;
    amount: number;
    documents?: ImportExpenseDocument[];
  }>;
  productId: string;
  productName: string;
  productSku: string;
  additionalCostName?: string;
  importDate: string;
  importedQuantity: number;
  purchaseUnitCostOrigin: number;
  freightCost?: number;
  customsCost?: number;
  inlandLogisticsCost?: number;
  taxesCost?: number;
  otherImportCosts?: number;
  totalImportCost: number;
  landedUnitCost: number;
  invoicedSaleUnitUsd?: number;
  invoicedSaleUnitCop?: number;
  invoicedLineTotalCop?: number;
  invoicedLineUtilityCop?: number;
  invoiceGeneratedAt?: string | null;
  active?: boolean;
};

type ImportBatchRecord = {
  containerReference: string;
  containerType: ContainerType;
  containerSize: "20ft" | "40ft";
  measurementUnit: ContainerMeasurementUnit;
  shipmentReference: string;
  importDate: string;
  notes: string;
  expenseItems: Array<{
    key: "freight" | "customs" | "inlandLogistics" | "taxes" | "other";
    label: string;
    amount: number;
    documents?: ImportExpenseDocument[];
  }>;
  products: Array<{
    productId: string;
    importedQuantity: number;
    purchaseUnitCostOrigin: number;
  }>;
};

type ImportBatchSummaryRow = {
  containerReference: string;
  containerSize: string;
  shipmentReference: string;
  importDate: string;
  totalImportCost: number;
};

type FixedCostRecord = {
  _id?: string;
  name: string;
  category: string;
  frequency: string;
  amount: number;
  startDate: string;
  notes?: string;
  active?: boolean;
};

type OperationalExpenseRecord = {
  _id?: string;
  name: string;
  category: string;
  amount: number;
  expenseDate: string;
  notes?: string;
  active?: boolean;
};

type LogisticsAccountingModalKind = "logistics-fixed-cost" | "logistics-expense" | "logistics-invoice";

type LogisticsInvoiceItem = {
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  salePriceAwg: number;
  lineTotalAwg: number;
  unitCostAwg: number;
  lineUtilityAwg: number;
};

type LogisticsInvoiceRecord = {
  _id?: string;
  orderId?: string;
  invoiceDate: string;
  storeName: string;
  salesRepName?: string;
  routeName?: string;
  notes?: string;
  items: LogisticsInvoiceItem[];
  totalRevenueAwg: number;
  totalCostAwg: number;
  totalUtilityAwg: number;
  active?: boolean;
};

type LogisticsBilledOrderRecord = {
  _id?: string;
  orderId: string;
  invoiceDate: string;
  storeName: string;
  salesRepName?: string;
  routeName?: string;
  totalCostAwg: number;
  totalRevenueAwg: number;
  totalUtilityAwg: number;
};

type LogisticsFixedCostRecord = {
  _id?: string;
  name: string;
  category: string;
  frequency: string;
  amountAwg: number;
  startDate: string;
  notes?: string;
  active?: boolean;
};

type LogisticsExpenseRecord = {
  _id?: string;
  name: string;
  category: string;
  amountAwg: number;
  expenseDate: string;
  notes?: string;
  active?: boolean;
};

type LogisticsInvoiceFormState = {
  storeName: string;
  salesRepName: string;
  routeName: string;
  invoiceDate: string;
  notes: string;
  items: Array<{
    productId: string;
    productName: string;
    productSku: string;
    quantity: string;
    salePriceAwg: string;
    unitCostAwg: string;
  }>;
};

const apiBaseUrl =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "https://sps-backend-jxms.onrender.com/api";
const cloudinaryCloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined;
const cloudinaryUploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string | undefined;
const sessionStorageKey = "spste-session-user";
const containerImportTemplateStorageKey = "spste-import-container-templates";
const cubicFeetPerCubicMeter = 35.3147;
const dashboardKpiSectionMap: Record<string, ActiveSection> = {
  Clientes: "clients",
  Productos: "products",
  "Rutas asignadas": "routes",
  "Stock en bodega (AWG)": "inventory",
  "Ventas del mes Aruba (AWG)": "logistics-accounting",
  "Utilidad del mes Aruba (AWG)": "logistics-accounting",
  "Ventas del mes Colombia (COP)": "accounting",
  "Utilidad del mes Colombia (COP)": "accounting",
};

function readPersistedSessionUser(): SessionUser | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const storedValue = window.localStorage.getItem(sessionStorageKey);

    if (!storedValue) {
      return null;
    }

    const parsedValue = JSON.parse(storedValue) as Partial<SessionUser>;

    if (
      typeof parsedValue.id !== "string"
      || typeof parsedValue.name !== "string"
      || typeof parsedValue.email !== "string"
      || typeof parsedValue.role !== "string"
    ) {
      window.localStorage.removeItem(sessionStorageKey);
      return null;
    }

    return {
      id: parsedValue.id,
      name: parsedValue.name,
      email: parsedValue.email,
      role: parsedValue.role,
    };
  } catch {
    window.localStorage.removeItem(sessionStorageKey);
    return null;
  }
}

function readPersistedImportContainerTemplates(): ImportContainerTemplateRecord[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const storedValue = window.localStorage.getItem(containerImportTemplateStorageKey);

    if (!storedValue) {
      return [];
    }

    const parsedValue = JSON.parse(storedValue);

    if (!Array.isArray(parsedValue)) {
      window.localStorage.removeItem(containerImportTemplateStorageKey);
      return [];
    }

    return parsedValue.filter((entry): entry is ImportContainerTemplateRecord => {
      if (typeof entry !== "object" || entry === null) {
        return false;
      }

      const current = entry as Record<string, unknown>;
      return (
        typeof current.id === "string"
        && typeof current.name === "string"
        && typeof current.containerType === "string"
        && typeof current.containerSize === "string"
        && typeof current.measurementUnit === "string"
        && Array.isArray(current.products)
        && Array.isArray(current.expenseItems)
      );
    });
  } catch {
    window.localStorage.removeItem(containerImportTemplateStorageKey);
    return [];
  }
}

const sidebarItems = [
  { key: "dashboard", label: "Dashboard" },
  { key: "clients", label: "Clientes" },
  { key: "categories", label: "Categorias" },
  { key: "suppliers", label: "Proveedores" },
  { key: "products", label: "Productos" },
  { key: "warehouses", label: "Bodegas" },
  { key: "inventory", label: "Inventario" },
  { key: "orders", label: "Pedidos" },
  { key: "users", label: "Usuarios" },
  { key: "routes", label: "Rutas" },
  { key: "catalog", label: "Catalogo" },
  { key: "imports", label: "Exportaciones" },
  { key: "import-billing", label: "Facturacion" },
  { key: "accounting", label: "Contabilidad" },
  { key: "logistics-accounting", label: "Contabilidad Logistica" },
] as const;

const managementSidebarSections = [
  {
    key: "logistica",
    label: "Logistica",
    items: [
      { key: "inventory", label: "Inventario" },
      { key: "routes", label: "Rutas" },
      { key: "logistics-accounting", label: "Contabilidad" },
    ],
  },
  {
    key: "ventas",
    label: "Ventas",
    items: [
      { key: "orders", label: "Pedidos" },
      { key: "catalog", label: "Catalogo" },
    ],
  },
  {
    key: "operaciones-col",
    label: "Operaciones Col",
    items: [
      { key: "imports", label: "Exportaciones" },
      { key: "import-billing", label: "Facturacion" },
      { key: "accounting", label: "Contabilidad" },
    ],
  },
  {
    key: "parametrizacion",
    label: "Parametrizacion",
    items: [
      { key: "categories", label: "Categorias" },
      { key: "suppliers", label: "Proveedores" },
      { key: "products", label: "Productos" },
      { key: "clients", label: "Clientes" },
      { key: "warehouses", label: "Bodega" },
      { key: "users", label: "Usuarios" },
    ],
  },
] as const;

const roleOptions = [
  { value: "sales-rep-aruba", label: "Vendedor Aruba" },
  { value: "warehouse-aruba", label: "Bodega Aruba" },
  { value: "colombia-ops", label: "Operaciones Colombia" },
  { value: "management", label: "Gerencia" },
];

const fixedCostCategoryOptions = [
  { value: "payroll", label: "Nomina" },
  { value: "rent", label: "Arriendo" },
  { value: "utilities", label: "Servicios" },
  { value: "administration", label: "Administracion" },
  { value: "other", label: "Otro" },
];

const fixedCostFrequencyOptions = [
  { value: "monthly", label: "Mensual" },
  { value: "biweekly", label: "Quincenal" },
  { value: "weekly", label: "Semanal" },
  { value: "annual", label: "Anual" },
  { value: "one-time", label: "Unica vez" },
];

const operationalExpenseCategoryOptions = [
  { value: "fuel", label: "Combustible" },
  { value: "maintenance", label: "Mantenimiento" },
  { value: "unforeseen", label: "Imprevistos" },
  { value: "logistics", label: "Logistica" },
  { value: "tolls", label: "Peajes" },
  { value: "other", label: "Otro" },
];

const containerSizeOptions = [
  { value: "20ft", label: "20 pies" },
  { value: "40ft", label: "40 pies" },
] as const;

const containerTypeOptions = [
  { value: "refrigerado", label: "Refrigerado" },
  { value: "seco", label: "Seco" },
] as const;

const containerMeasurementUnitOptions = [
  { value: "m3", label: "m3" },
  { value: "pie3", label: "pie3" },
  { value: "kg", label: "kg" },
] as const;

const importExpenseTypeOptions = [
  { value: "freight", label: "Flete" },
  { value: "customs", label: "Nacionalizacion" },
  { value: "inlandLogistics", label: "Transporte a bodega" },
  { value: "taxes", label: "Impuestos" },
  { value: "other", label: "Otro" },
] as const;

const unitsPerBoxUnitOptions = [
  { value: "kg", label: "KG" },
  { value: "lb", label: "LB" },
  { value: "unidad", label: "UNIDAD" },
  { value: "paquete", label: "PAQUETE" },
];

const inventoryAdjustmentReasonOptions = [
  { value: "vencido", label: "Se vencio" },
  { value: "danado", label: "Llego danado" },
  { value: "merma", label: "Merma o perdida" },
  { value: "muestra", label: "Muestra comercial" },
  { value: "otro", label: "Otro" },
] as const;

const containerCapacityBySize = {
  "20ft": 30,
  "40ft": 60,
} as const;

const containerCapacityKgBySize = {
  "20ft": 24000,
  "40ft": 48000,
} as const;

const phoneCountryOptions = [
  { value: "+93", label: "+93 AF" },
  { value: "+355", label: "+355 AL" },
  { value: "+213", label: "+213 DZ" },
  { value: "+1-684", label: "+1-684 AS" },
  { value: "+376", label: "+376 AD" },
  { value: "+244", label: "+244 AO" },
  { value: "+1-264", label: "+1-264 AI" },
  { value: "+1-268", label: "+1-268 AG" },
  { value: "+54", label: "+54 AR" },
  { value: "+374", label: "+374 AM" },
  { value: "+297", label: "+297 AW" },
  { value: "+61", label: "+61 AU" },
  { value: "+43", label: "+43 AT" },
  { value: "+994", label: "+994 AZ" },
  { value: "+1-242", label: "+1-242 BS" },
  { value: "+973", label: "+973 BH" },
  { value: "+880", label: "+880 BD" },
  { value: "+1-246", label: "+1-246 BB" },
  { value: "+375", label: "+375 BY" },
  { value: "+32", label: "+32 BE" },
  { value: "+501", label: "+501 BZ" },
  { value: "+229", label: "+229 BJ" },
  { value: "+1-441", label: "+1-441 BM" },
  { value: "+975", label: "+975 BT" },
  { value: "+591", label: "+591 BO" },
  { value: "+387", label: "+387 BA" },
  { value: "+267", label: "+267 BW" },
  { value: "+55", label: "+55 BR" },
  { value: "+246", label: "+246 IO" },
  { value: "+1-284", label: "+1-284 VG" },
  { value: "+673", label: "+673 BN" },
  { value: "+359", label: "+359 BG" },
  { value: "+226", label: "+226 BF" },
  { value: "+257", label: "+257 BI" },
  { value: "+855", label: "+855 KH" },
  { value: "+237", label: "+237 CM" },
  { value: "+1", label: "+1 CA" },
  { value: "+238", label: "+238 CV" },
  { value: "+1-345", label: "+1-345 KY" },
  { value: "+236", label: "+236 CF" },
  { value: "+235", label: "+235 TD" },
  { value: "+56", label: "+56 CL" },
  { value: "+86", label: "+86 CN" },
  { value: "+61", label: "+61 CX" },
  { value: "+61", label: "+61 CC" },
  { value: "+57", label: "+57 CO" },
  { value: "+269", label: "+269 KM" },
  { value: "+242", label: "+242 CG" },
  { value: "+243", label: "+243 CD" },
  { value: "+682", label: "+682 CK" },
  { value: "+506", label: "+506 CR" },
  { value: "+225", label: "+225 CI" },
  { value: "+385", label: "+385 HR" },
  { value: "+53", label: "+53 CU" },
  { value: "+599", label: "+599 CW" },
  { value: "+357", label: "+357 CY" },
  { value: "+420", label: "+420 CZ" },
  { value: "+45", label: "+45 DK" },
  { value: "+253", label: "+253 DJ" },
  { value: "+1-767", label: "+1-767 DM" },
  { value: "+1-809", label: "+1-809 DO" },
  { value: "+1-829", label: "+1-829 DO" },
  { value: "+1-849", label: "+1-849 DO" },
  { value: "+670", label: "+670 TL" },
  { value: "+593", label: "+593 EC" },
  { value: "+20", label: "+20 EG" },
  { value: "+503", label: "+503 SV" },
  { value: "+240", label: "+240 GQ" },
  { value: "+291", label: "+291 ER" },
  { value: "+372", label: "+372 EE" },
  { value: "+268", label: "+268 SZ" },
  { value: "+251", label: "+251 ET" },
  { value: "+500", label: "+500 FK" },
  { value: "+298", label: "+298 FO" },
  { value: "+679", label: "+679 FJ" },
  { value: "+358", label: "+358 FI" },
  { value: "+33", label: "+33 FR" },
  { value: "+594", label: "+594 GF" },
  { value: "+689", label: "+689 PF" },
  { value: "+241", label: "+241 GA" },
  { value: "+220", label: "+220 GM" },
  { value: "+995", label: "+995 GE" },
  { value: "+49", label: "+49 DE" },
  { value: "+233", label: "+233 GH" },
  { value: "+350", label: "+350 GI" },
  { value: "+30", label: "+30 GR" },
  { value: "+299", label: "+299 GL" },
  { value: "+1-473", label: "+1-473 GD" },
  { value: "+590", label: "+590 GP" },
  { value: "+1-671", label: "+1-671 GU" },
  { value: "+502", label: "+502 GT" },
  { value: "+44", label: "+44 GG" },
  { value: "+224", label: "+224 GN" },
  { value: "+245", label: "+245 GW" },
  { value: "+592", label: "+592 GY" },
  { value: "+509", label: "+509 HT" },
  { value: "+504", label: "+504 HN" },
  { value: "+852", label: "+852 HK" },
  { value: "+36", label: "+36 HU" },
  { value: "+354", label: "+354 IS" },
  { value: "+91", label: "+91 IN" },
  { value: "+62", label: "+62 ID" },
  { value: "+98", label: "+98 IR" },
  { value: "+964", label: "+964 IQ" },
  { value: "+353", label: "+353 IE" },
  { value: "+44", label: "+44 IM" },
  { value: "+972", label: "+972 IL" },
  { value: "+39", label: "+39 IT" },
  { value: "+1-876", label: "+1-876 JM" },
  { value: "+81", label: "+81 JP" },
  { value: "+44", label: "+44 JE" },
  { value: "+962", label: "+962 JO" },
  { value: "+7", label: "+7 KZ" },
  { value: "+254", label: "+254 KE" },
  { value: "+686", label: "+686 KI" },
  { value: "+383", label: "+383 XK" },
  { value: "+965", label: "+965 KW" },
  { value: "+996", label: "+996 KG" },
  { value: "+856", label: "+856 LA" },
  { value: "+371", label: "+371 LV" },
  { value: "+961", label: "+961 LB" },
  { value: "+266", label: "+266 LS" },
  { value: "+231", label: "+231 LR" },
  { value: "+218", label: "+218 LY" },
  { value: "+423", label: "+423 LI" },
  { value: "+370", label: "+370 LT" },
  { value: "+352", label: "+352 LU" },
  { value: "+853", label: "+853 MO" },
  { value: "+261", label: "+261 MG" },
  { value: "+265", label: "+265 MW" },
  { value: "+60", label: "+60 MY" },
  { value: "+960", label: "+960 MV" },
  { value: "+223", label: "+223 ML" },
  { value: "+356", label: "+356 MT" },
  { value: "+692", label: "+692 MH" },
  { value: "+596", label: "+596 MQ" },
  { value: "+222", label: "+222 MR" },
  { value: "+230", label: "+230 MU" },
  { value: "+262", label: "+262 YT" },
  { value: "+52", label: "+52 MX" },
  { value: "+691", label: "+691 FM" },
  { value: "+373", label: "+373 MD" },
  { value: "+377", label: "+377 MC" },
  { value: "+976", label: "+976 MN" },
  { value: "+382", label: "+382 ME" },
  { value: "+1-664", label: "+1-664 MS" },
  { value: "+212", label: "+212 MA" },
  { value: "+258", label: "+258 MZ" },
  { value: "+95", label: "+95 MM" },
  { value: "+264", label: "+264 NA" },
  { value: "+674", label: "+674 NR" },
  { value: "+977", label: "+977 NP" },
  { value: "+31", label: "+31 NL" },
  { value: "+687", label: "+687 NC" },
  { value: "+64", label: "+64 NZ" },
  { value: "+505", label: "+505 NI" },
  { value: "+227", label: "+227 NE" },
  { value: "+234", label: "+234 NG" },
  { value: "+683", label: "+683 NU" },
  { value: "+850", label: "+850 KP" },
  { value: "+1-670", label: "+1-670 MP" },
  { value: "+47", label: "+47 NO" },
  { value: "+968", label: "+968 OM" },
  { value: "+92", label: "+92 PK" },
  { value: "+680", label: "+680 PW" },
  { value: "+970", label: "+970 PS" },
  { value: "+507", label: "+507 PA" },
  { value: "+675", label: "+675 PG" },
  { value: "+595", label: "+595 PY" },
  { value: "+51", label: "+51 PE" },
  { value: "+63", label: "+63 PH" },
  { value: "+48", label: "+48 PL" },
  { value: "+351", label: "+351 PT" },
  { value: "+1-787", label: "+1-787 PR" },
  { value: "+1-939", label: "+1-939 PR" },
  { value: "+974", label: "+974 QA" },
  { value: "+262", label: "+262 RE" },
  { value: "+40", label: "+40 RO" },
  { value: "+7", label: "+7 RU" },
  { value: "+250", label: "+250 RW" },
  { value: "+590", label: "+590 BL" },
  { value: "+290", label: "+290 SH" },
  { value: "+1-869", label: "+1-869 KN" },
  { value: "+1-758", label: "+1-758 LC" },
  { value: "+590", label: "+590 MF" },
  { value: "+508", label: "+508 PM" },
  { value: "+1-784", label: "+1-784 VC" },
  { value: "+685", label: "+685 WS" },
  { value: "+378", label: "+378 SM" },
  { value: "+239", label: "+239 ST" },
  { value: "+966", label: "+966 SA" },
  { value: "+221", label: "+221 SN" },
  { value: "+381", label: "+381 RS" },
  { value: "+248", label: "+248 SC" },
  { value: "+232", label: "+232 SL" },
  { value: "+65", label: "+65 SG" },
  { value: "+1-721", label: "+1-721 SX" },
  { value: "+421", label: "+421 SK" },
  { value: "+386", label: "+386 SI" },
  { value: "+677", label: "+677 SB" },
  { value: "+252", label: "+252 SO" },
  { value: "+27", label: "+27 ZA" },
  { value: "+82", label: "+82 KR" },
  { value: "+211", label: "+211 SS" },
  { value: "+34", label: "+34 ES" },
  { value: "+94", label: "+94 LK" },
  { value: "+249", label: "+249 SD" },
  { value: "+597", label: "+597 SR" },
  { value: "+47", label: "+47 SJ" },
  { value: "+46", label: "+46 SE" },
  { value: "+41", label: "+41 CH" },
  { value: "+963", label: "+963 SY" },
  { value: "+886", label: "+886 TW" },
  { value: "+992", label: "+992 TJ" },
  { value: "+255", label: "+255 TZ" },
  { value: "+66", label: "+66 TH" },
  { value: "+228", label: "+228 TG" },
  { value: "+690", label: "+690 TK" },
  { value: "+676", label: "+676 TO" },
  { value: "+1-868", label: "+1-868 TT" },
  { value: "+216", label: "+216 TN" },
  { value: "+90", label: "+90 TR" },
  { value: "+993", label: "+993 TM" },
  { value: "+1-649", label: "+1-649 TC" },
  { value: "+688", label: "+688 TV" },
  { value: "+1-340", label: "+1-340 VI" },
  { value: "+256", label: "+256 UG" },
  { value: "+380", label: "+380 UA" },
  { value: "+971", label: "+971 AE" },
  { value: "+44", label: "+44 GB" },
  { value: "+1", label: "+1 US" },
  { value: "+598", label: "+598 UY" },
  { value: "+998", label: "+998 UZ" },
  { value: "+678", label: "+678 VU" },
  { value: "+379", label: "+379 VA" },
  { value: "+58", label: "+58 VE" },
  { value: "+84", label: "+84 VN" },
  { value: "+681", label: "+681 WF" },
  { value: "+212", label: "+212 EH" },
  { value: "+967", label: "+967 YE" },
  { value: "+260", label: "+260 ZM" },
  { value: "+263", label: "+263 ZW" },
];

const routeDayOptions: Array<{ key: RouteDayKey; label: string }> = [
  { key: "monday", label: "Lunes" },
  { key: "tuesday", label: "Martes" },
  { key: "wednesday", label: "Miercoles" },
  { key: "thursday", label: "Jueves" },
  { key: "friday", label: "Viernes" },
  { key: "saturday", label: "Sabado" },
  { key: "sunday", label: "Domingo" },
];

const defaultCollectionKey = "users";
const kpiPlaceholders = Array.from({ length: 7 }, (_, index) => index);
const creationSectionKeys = ["users", "clients", "categories", "products", "suppliers", "warehouses"] as const;

function createInitialSectionFilters(): SectionFilters {
  return {
    search: "",
    primary: "",
    secondary: "",
  };
}

function splitPhoneNumber(phone: unknown, countryCode: unknown) {
  const normalizedPhone = typeof phone === "string" ? phone.trim() : "";
  const normalizedCountryCode = typeof countryCode === "string" ? countryCode.trim() : "";

  if (!normalizedPhone) {
    return "";
  }

  if (normalizedCountryCode && normalizedPhone.startsWith(`${normalizedCountryCode} `)) {
    return normalizedPhone.slice(normalizedCountryCode.length).trim();
  }

  return normalizedPhone;
}

function getFormFieldInitialValue(field: FieldConfig, row: Record<string, unknown> | null) {
  if (field.type === "file" || field.type === "group-title") {
    return "";
  }

  if (field.name === "unitsPerBoxUnit" && !row) {
    return "unidad";
  }

  if (field.name === "arubaUsdToAwgRate" && !row) {
    return "1.79";
  }

  if (field.name === "arubaPurchaseCostUsd" && !row) {
    return "0";
  }

  if (!row) {
    return field.type === "select" ? field.options?.[0]?.value ?? "" : "";
  }

  if (field.name === "phone") {
    return splitPhoneNumber(row.phone, row.phoneCountryCode);
  }

  const value = row[field.name];

  if (value === null || value === undefined || value === "") {
    if (field.name === "unitsPerBoxUnit") {
      return "unidad";
    }

    if (field.name === "arubaUsdToAwgRate") {
      return "1.79";
    }

    if (field.name === "arubaPurchaseCostUsd") {
      return "0";
    }

    return field.type === "select" ? field.options?.[0]?.value ?? "" : "";
  }

  if (field.type === "date") {
    const normalizedValue = String(value).trim();
    return normalizedValue ? normalizedValue.slice(0, 10) : "";
  }

  return String(value);
}

function getProductVariableSalePriceValue(row: Record<string, unknown> | null) {
  return Boolean(row?.variableSalePrice);
}

function getNormalizedRowValue(row: Record<string, unknown>, key: string) {
  const value = row[key];

  if (typeof value === "boolean") {
    return value ? "si" : "no";
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim().toLowerCase();
}

function countRowsWithValue(rows: Array<Record<string, unknown>>, key: string) {
  return rows.filter((row) => getNormalizedRowValue(row, key).length > 0).length;
}

function countUniqueRowValues(rows: Array<Record<string, unknown>>, key: string) {
  return new Set(rows.map((row) => getNormalizedRowValue(row, key)).filter(Boolean)).size;
}

function getCreationFilterDefinitions(
  sectionKey: (typeof creationSectionKeys)[number],
): [CreationFilterDefinition, CreationFilterDefinition] {
  switch (sectionKey) {
    case "users":
      return [
        { key: "name", label: "Nombre", placeholder: "Filtrar por nombre" },
        { key: "role", label: "Rol", placeholder: "Filtrar por rol" },
      ];
    case "clients":
      return [
        { key: "name", label: "Cliente", placeholder: "Filtrar por cliente" },
        { key: "managerName", label: "Encargado", placeholder: "Filtrar por encargado" },
      ];
    case "categories":
      return [
        { key: "code", label: "Codigo", placeholder: "Filtrar por codigo" },
        { key: "name", label: "Categoria", placeholder: "Filtrar por categoria" },
      ];
    case "products":
      return [
        { key: "sku", label: "SKU", placeholder: "Filtrar por SKU" },
        { key: "category", label: "Categoria", placeholder: "Filtrar por categoria" },
      ];
    case "suppliers":
      return [
        { key: "name", label: "Proveedor", placeholder: "Filtrar por proveedor" },
        { key: "contactName", label: "Contacto", placeholder: "Filtrar por contacto" },
      ];
    case "warehouses":
      return [
        { key: "name", label: "Bodega", placeholder: "Filtrar por bodega" },
        { key: "address", label: "Direccion", placeholder: "Filtrar por direccion" },
      ];
  }
}

function buildCreationKpis(
  sectionKey: (typeof creationSectionKeys)[number],
  rows: Array<Record<string, unknown>>,
  warehouseLocations: WarehouseLocationRecord[],
) {
  switch (sectionKey) {
    case "users":
      return [
        { label: "Usuarios registrados", value: rows.length, tone: "cyan" },
        { label: "Usuarios activos", value: rows.filter((row) => row.active !== false).length, tone: "amber" },
        { label: "Vendedores Aruba", value: rows.filter((row) => row.role === "sales-rep-aruba").length, tone: "slate" },
        { label: "Equipo de bodega", value: rows.filter((row) => row.role === "warehouse-aruba").length, tone: "cyan" },
      ] satisfies KpiCard[];
    case "clients":
      return [
        { label: "Clientes registrados", value: rows.length, tone: "cyan" },
        { label: "Con encargado", value: countRowsWithValue(rows, "managerName"), tone: "amber" },
        { label: "Con correo", value: countRowsWithValue(rows, "email"), tone: "slate" },
        { label: "Con direccion", value: countRowsWithValue(rows, "address"), tone: "cyan" },
      ] satisfies KpiCard[];
    case "categories":
      return [
        { label: "Categorias", value: rows.length, tone: "cyan" },
        { label: "Con descripcion", value: countRowsWithValue(rows, "description"), tone: "amber" },
        { label: "Activas", value: rows.filter((row) => row.active !== false).length, tone: "slate" },
        { label: "Codigos unicos", value: countUniqueRowValues(rows, "code"), tone: "cyan" },
      ] satisfies KpiCard[];
    case "products":
      return [
        { label: "Productos", value: rows.length, tone: "cyan" },
        { label: "Categorias cubiertas", value: countUniqueRowValues(rows, "category"), tone: "amber" },
        { label: "Proveedores activos", value: countUniqueRowValues(rows, "supplier"), tone: "slate" },
        { label: "Con imagen", value: countRowsWithValue(rows, "imageUrl"), tone: "cyan" },
      ] satisfies KpiCard[];
    case "suppliers":
      return [
        { label: "Proveedores", value: rows.length, tone: "cyan" },
        { label: "Con contacto", value: countRowsWithValue(rows, "contactName"), tone: "amber" },
        { label: "Con correo", value: countRowsWithValue(rows, "email"), tone: "slate" },
        { label: "Con telefono", value: countRowsWithValue(rows, "phone"), tone: "cyan" },
      ] satisfies KpiCard[];
    case "warehouses":
      return [
        { label: "Bodegas registradas", value: rows.length, tone: "cyan" },
        { label: "Con direccion", value: countRowsWithValue(rows, "address"), tone: "amber" },
        { label: "Productos ubicados", value: new Set(warehouseLocations.map((location) => location.productId)).size, tone: "slate" },
        {
          label: "Posiciones activas",
          value: new Set(warehouseLocations.map((location) => `${location.shelf}-${location.floor}-${location.rack}`)).size,
          tone: "cyan",
        },
      ] satisfies KpiCard[];
  }
}

function getCurrentWeekStart() {
  const date = new Date();
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

function createEmptyDayAssignments(): Record<RouteDayKey, string[]> {
  return {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: [],
  };
}

function createInitialRouteForm(): RouteFormState {
  return {
    name: "",
    salesRepId: "",
    weekStart: getCurrentWeekStart(),
    notes: "",
    dayAssignments: createEmptyDayAssignments(),
  };
}

function createInitialWarehouseLocationForm(): WarehouseLocationFormState {
  return {
    productId: "",
    shelf: "",
    floor: "",
    rack: "",
  };
}

function createInitialCatalogForm(): CatalogFormState {
  return {
    name: "",
    description: "",
    categoryNames: [],
    productIds: [],
  };
}

function createInitialClientProductDraft(): ClientProductDraft {
  return {
    productIds: [],
  };
}

function createImportExpenseItem(
  key: ImportExpenseItemFormState["key"] = "freight",
  overrides?: Partial<Omit<ImportExpenseItemFormState, "id" | "key">>,
): ImportExpenseItemFormState {
  const defaultLabel = importExpenseTypeOptions.find((option) => option.value === key)?.label ?? "Otro";

  return {
    id: `${key}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    key,
    label: key === "other" ? overrides?.label ?? "" : defaultLabel,
    amount: overrides?.amount ?? "",
    documents: overrides?.documents ?? [],
    isUploading: false,
    error: "",
    saved: overrides?.saved ?? false,
  };
}

function getCollectionConfigs(
  categoryOptions: CategoryOption[],
  supplierOptions: SupplierOption[],
): CollectionConfig[] {
  return [
    {
      key: "users",
      title: "Nuevos usuarios",
      description: "Crea credenciales y asigna el rol operativo correspondiente.",
      endpoint: "/management/users",
      fields: [
        { name: "name", label: "Nombre completo", type: "text", placeholder: "Juan Perez" },
        { name: "email", label: "Correo", type: "email", placeholder: "usuario@spste.com" },
        { name: "password", label: "Contrasena", type: "password", placeholder: "Temporal" },
        { name: "role", label: "Rol", type: "select", options: roleOptions },
      ],
      tableColumns: [
        { key: "name", label: "Nombre" },
        { key: "email", label: "Correo" },
        { key: "role", label: "Rol" },
        { key: "active", label: "Activo" },
      ],
    },
    {
      key: "clients",
      title: "Crear clientes",
      description: "Registra nuevas tiendas o clientes atendidos por SPS.",
      endpoint: "/management/clients",
      fields: [
        { name: "name", label: "Nombre comercial", type: "text", placeholder: "Supermercado Aruba" },
        { name: "managerName", label: "Nombre del encargado", type: "text", placeholder: "Ana Ruiz" },
        { name: "email", label: "Correo", type: "email", placeholder: "compras@cliente.com" },
        {
          name: "phoneCountryCode",
          label: "Codigo",
          type: "select",
          options: phoneCountryOptions,
          width: "third",
        },
        {
          name: "phone",
          label: "Telefono",
          type: "text",
          placeholder: "300 000 0000",
          width: "two-third",
        },
        { name: "address", label: "Direccion", type: "text", placeholder: "Main Street 12" },
      ],
      tableColumns: [
        { key: "name", label: "Cliente" },
        { key: "managerName", label: "Encargado" },
        { key: "email", label: "Correo" },
        { key: "phone", label: "Telefono" },
        { key: "assignedProductIds", label: "Productos asignados" },
      ],
    },
    {
      key: "categories",
      title: "Crear categorias",
      description: "Define familias de frutas, verduras y otros grupos de venta.",
      endpoint: "/management/categories",
      fields: [
        { name: "name", label: "Nombre", type: "text", placeholder: "Frutas frescas" },
      ],
      tableColumns: [
        { key: "code", label: "Codigo" },
        { key: "name", label: "Categoria" },
        { key: "description", label: "Descripcion" },
      ],
    },
    {
      key: "products",
      title: "Crear productos",
      description: "Incorpora productos listos para compra, almacenamiento y despacho.",
      endpoint: "/management/products",
      fields: [
        { name: "sku", label: "SKU", type: "text", placeholder: "PROD-001" },
        { name: "name", label: "Nombre", type: "text", placeholder: "Mango Tommy" },
        { name: "category", label: "Categoria", type: "select", options: categoryOptions },
        { name: "supplier", label: "Proveedor", type: "select", options: supplierOptions },
        { name: "imageFile", label: "Imagen del producto", type: "file" },
        { name: "productWeightKg", label: "Peso por unidad (kg)", type: "number", placeholder: "0.35", width: "third" },
        { name: "boxDimensionsTitle", label: "Tamano de caja", type: "group-title" },
        { name: "boxLengthCm", label: "Largo (cm)", type: "number", placeholder: "40", width: "third" },
        { name: "boxWidthCm", label: "Ancho (cm)", type: "number", placeholder: "30", width: "third" },
        { name: "boxHeightCm", label: "Alto (cm)", type: "number", placeholder: "25", width: "third" },
        { name: "unitsPerBox", label: "Unidades x caja", type: "number", placeholder: "24", width: "two-third" },
        { name: "unitsPerBoxUnit", label: "Unidad de medicion", type: "select", options: unitsPerBoxUnitOptions, width: "third" },
        { name: "inventoryAlert", label: "Alerta de inventario", type: "number", placeholder: "20" },
      ],
      tableColumns: [
        { key: "sku", label: "SKU" },
        { key: "name", label: "Producto" },
        { key: "category", label: "Categoria" },
        { key: "supplier", label: "Proveedor" },
        { key: "productWeightKg", label: "Peso (kg/u)" },
        { key: "salePrice", label: "Venta" },
      ],
    },
    {
      key: "suppliers",
      title: "Crear proveedores",
      description: "Registra proveedores para compras y reabastecimiento.",
      endpoint: "/management/suppliers",
      fields: [
        { name: "name", label: "Empresa", type: "text", placeholder: "Agroexport SAS" },
        { name: "contactName", label: "Nombre", type: "text", placeholder: "Laura Gomez" },
        { name: "email", label: "Correo", type: "email", placeholder: "compras@proveedor.com" },
        {
          name: "phoneCountryCode",
          label: "Codigo",
          type: "select",
          options: phoneCountryOptions,
          width: "third",
        },
        {
          name: "phone",
          label: "Telefono",
          type: "text",
          placeholder: "300 000 0000",
          width: "two-third",
        },
      ],
      tableColumns: [
        { key: "name", label: "Proveedor" },
        { key: "contactName", label: "Nombre" },
        { key: "email", label: "Correo" },
        { key: "phone", label: "Telefono" },
      ],
    },
    {
      key: "warehouses",
      title: "Crear bodegas",
      description: "Administra centros de distribucion y exportacion.",
      endpoint: "/management/warehouses",
      fields: [
        { name: "name", label: "Nombre", type: "text", placeholder: "Bodega Aruba Central" },
        { name: "address", label: "Direccion", type: "text", placeholder: "Zona Industrial 4" },
      ],
      tableColumns: [
        { key: "name", label: "Bodega" },
        { key: "address", label: "Direccion" },
      ],
    },
  ];
}

function getOptionLabel(title: string) {
  const label = title.replace(/^Crear\s+/i, "").replace(/^Nuevos\s+/i, "");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function buildPayload(formData: FormData, fields: FieldConfig[]) {
  return fields.reduce<Record<string, string | number | boolean | null>>((payload, field) => {
    if (field.type === "group-title" || field.type === "file") {
      return payload;
    }

    const value = formData.get(field.name);

    if (typeof value !== "string") {
      return payload;
    }

    payload[field.name] = field.type === "number" ? Number(value) : value.trim();

    if (field.name === "phone" && typeof payload.phoneCountryCode === "string") {
      payload[field.name] = `${payload.phoneCountryCode} ${String(payload[field.name]).trim()}`;
    }

    return payload;
  }, {});
}

function formatCellValue(value: unknown) {
  if (typeof value === "boolean") {
    return value ? "Si" : "No";
  }

  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return String(value);
}

function formatRouteDayLabel(day: RouteDayKey) {
  return routeDayOptions.find((option) => option.key === day)?.label ?? day;
}

function formatSellerOrderStatus(status: SellerOrderRecord["status"]) {
  const labels: Record<SellerOrderRecord["status"], string> = {
    draft: "Borrador",
    submitted: "Enviado a bodega",
    picking: "Preparando",
    dispatched: "Despachado",
    delivered: "Entregado",
  };

  return labels[status] ?? status;
}

function formatSellerOrderDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-ES", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function canEditSellerOrder(createdAt: string) {
  const createdAtDate = new Date(createdAt);

  if (Number.isNaN(createdAtDate.getTime())) {
    return false;
  }

  return Date.now() - createdAtDate.getTime() <= 6 * 60 * 60 * 1000;
}

function formatRouteStoresSummary(days: RouteDayAssignment[]) {
  return days
    .map((day) => `${formatRouteDayLabel(day.day)}: ${day.stores.map((store) => store.storeName).join(", ")}`)
    .join(" | ");
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatAwgCurrency(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "decimal",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatAwgCurrency2(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "decimal",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatUsdCurrency(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function parseDecimalInput(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : Number.NaN;
  }

  if (typeof value !== "string") {
    return Number.NaN;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return Number.NaN;
  }

  let normalized = trimmed.replace(/\s+/g, "");

  if (normalized.includes(",") && normalized.includes(".")) {
    if (normalized.lastIndexOf(",") > normalized.lastIndexOf(".")) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = normalized.replace(/,/g, "");
    }
  } else if (normalized.includes(",")) {
    normalized = normalized.replace(",", ".");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function formatCurrencyUpTwoDecimals(value: number) {
  const normalizedValue = Number.isFinite(value) ? value : 0;
  const roundedValue = normalizedValue >= 0
    ? Math.ceil(normalizedValue * 100) / 100
    : Math.floor(normalizedValue * 100) / 100;

  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(roundedValue);
}

function sanitizePdfFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

async function loadImageForPdf(imageUrl: string) {
  if (!imageUrl.trim()) {
    return null;
  }

  try {
    const response = await fetch(imageUrl);

    if (!response.ok) {
      return null;
    }

    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });

    if (!dataUrl) {
      return null;
    }

    return {
      dataUrl,
      format: dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG",
    } as const;
  } catch {
    return null;
  }
}

function formatUnitsPerBoxUnitLabel(unit: string) {
  return unitsPerBoxUnitOptions.find((option) => option.value === unit)?.label ?? "UNIDAD";
}

function normalizeMonthlyAmount(amount: number, frequency: string) {
  switch (frequency) {
    case "weekly":
      return amount * 4;
    case "biweekly":
      return amount * 2;
    case "annual":
      return amount / 12;
    case "one-time":
      return amount;
    case "monthly":
    default:
      return amount;
  }
}

function getFixedCostAmountForMonth(row: FixedCostRecord, monthKey: string) {
  const startMonth = String(row.startDate ?? "").slice(0, 7);

  if (row.frequency === "one-time") {
    return startMonth === monthKey ? Number(row.amount ?? 0) : 0;
  }

  return normalizeMonthlyAmount(Number(row.amount ?? 0), row.frequency);
}

function buildContainerImportProducts(
  products: ProductOption[],
  current: ContainerImportProductFormState[] = [],
) {
  const currentById = new Map(current.map((product) => [product.productId, product]));

  return products.map((product) => {
    const existing = currentById.get(product.value);

    return (
      existing ?? {
        productId: product.value,
        selected: false,
        boxCount: "",
        importedQuantity: "",
        purchaseUnitCostOrigin: "",
        purchaseBoxCostOrigin: "",
      }
    );
  });
}

function createInitialInventoryAdjustmentForm(): InventoryAdjustmentFormState {
  return {
    quantity: "",
    reason: "",
    notes: "",
  };
}

function createInitialLogisticsInvoiceForm(): LogisticsInvoiceFormState {
  return {
    storeName: "",
    salesRepName: "",
    routeName: "",
    invoiceDate: new Date().toISOString().slice(0, 10),
    notes: "",
    items: [{ productId: "", productName: "", productSku: "", quantity: "", salePriceAwg: "", unitCostAwg: "" }],
  };
}

function createInventoryEntryDraftItem(productId = ""): InventoryEntryDraftItem {
  return {
    id: `inventory-entry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    productId,
    quantity: "",
    costUsd: "",
    salePriceAwg: "",
    expirationDate: "",
    productWeightKg: "",
  };
}

function createInitialContainerImportForm(products: ProductOption[]): ContainerImportFormState {
  return {
    containerType: "seco",
    containerSize: "20ft",
    measurementUnit: "m3",
    importDate: new Date().toISOString().slice(0, 10),
    shipmentReference: "",
    expenseItems: [],
    notes: "",
    products: buildContainerImportProducts(products),
  };
}

function formatContainerType(value: ContainerType) {
  return containerTypeOptions.find((option) => option.value === value)?.label ?? value;
}

function formatContainerSize(value: string) {
  return containerSizeOptions.find((option) => option.value === value)?.label ?? value;
}

function getContainerCapacityCubicMeters(value: ContainerImportFormState["containerSize"]) {
  return containerCapacityBySize[value] ?? 30;
}

function getContainerCapacityKilograms(value: ContainerImportFormState["containerSize"]) {
  return containerCapacityKgBySize[value] ?? 24000;
}

function calculateProductBoxVolumeCubicMeters(product: Pick<ProductOption, "boxLengthCm" | "boxWidthCm" | "boxHeightCm">) {
  const length = Number(product.boxLengthCm || 0);
  const width = Number(product.boxWidthCm || 0);
  const height = Number(product.boxHeightCm || 0);

  if (length <= 0 || width <= 0 || height <= 0) {
    return 0;
  }

  return (length * width * height) / 1_000_000;
}

function calculateEstimatedBoxes(importedQuantity: number, unitsPerBox: number) {
  if (importedQuantity <= 0 || unitsPerBox <= 0) {
    return 0;
  }

  return Math.ceil(importedQuantity / unitsPerBox);
}

function formatCubicMeters(value: number) {
  return `${new Intl.NumberFormat("es-CO", {
    minimumFractionDigits: value < 10 ? 2 : 1,
    maximumFractionDigits: value < 10 ? 2 : 1,
  }).format(Number.isFinite(value) ? value : 0)} m3`;
}

function formatCubicFeet(value: number) {
  return `${new Intl.NumberFormat("es-CO", {
    minimumFractionDigits: value < 100 ? 2 : 1,
    maximumFractionDigits: value < 100 ? 2 : 1,
  }).format(Number.isFinite(value) ? value : 0)} pie3`;
}

function formatKilograms(value: number) {
  return `${new Intl.NumberFormat("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0)} kg`;
}

function formatContainerMeasure(value: number, unit: ContainerMeasurementUnit) {
  if (unit === "kg") {
    return formatKilograms(value);
  }

  if (unit === "pie3") {
    return formatCubicFeet(value);
  }

  return formatCubicMeters(value);
}

function roundCurrencyValue(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function isCreationSectionKey(
  value: string,
): value is (typeof creationSectionKeys)[number] {
  return creationSectionKeys.includes(value as (typeof creationSectionKeys)[number]);
}

function getRoleLabel(role: string) {
  switch (role) {
    case "management":
      return "Gerencia";
    case "sales-rep-aruba":
      return "Vendedor Aruba";
    case "warehouse-aruba":
      return "Bodega Aruba";
    case "colombia-ops":
      return "Operaciones Colombia";
    default:
      return "Acceso";
  }
}

function normalizeUppercaseInputTarget(target: EventTarget | null) {
  if (
    (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) &&
    target.closest(".filter-grid")
  ) {
    return;
  }

  if (target instanceof HTMLTextAreaElement) {
    const uppercaseValue = target.value.toUpperCase();

    if (target.value !== uppercaseValue) {
      const selectionStart = target.selectionStart;
      const selectionEnd = target.selectionEnd;
      target.value = uppercaseValue;

      if (selectionStart !== null && selectionEnd !== null) {
        target.setSelectionRange(selectionStart, selectionEnd);
      }
    }

    return;
  }

  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  if (!["text", "search", "email", "tel", "url"].includes(target.type)) {
    return;
  }

  const uppercaseValue = target.value.toUpperCase();

  if (target.value !== uppercaseValue) {
    const selectionStart = target.selectionStart;
    const selectionEnd = target.selectionEnd;
    target.value = uppercaseValue;

    if (selectionStart !== null && selectionEnd !== null) {
      target.setSelectionRange(selectionStart, selectionEnd);
    }
  }
}

export default function App() {
  const tablePaginationStateRef = useRef<Record<string, number>>({});
  const [email, setEmail] = useState("said@spste.com");
  const [password, setPassword] = useState("123456");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [activeSection, setActiveSection] = useState<ActiveSection>("inventory");
  const [sellerActiveSection, setSellerActiveSection] = useState<SellerActiveSection>("routes");
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(() => readPersistedSessionUser());
  const [kpis, setKpis] = useState<KpiCard[]>([]);
  const [isLoadingKpis, setIsLoadingKpis] = useState(false);
  const [creationStatuses, setCreationStatuses] = useState<Record<string, CreationStatus>>({});
  const [sectionFilters, setSectionFilters] = useState<Record<string, SectionFilters>>({});
  const [isCreationModalOpen, setIsCreationModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<Record<string, unknown> | null>(null);
  const [clientProductDraft, setClientProductDraft] = useState<ClientProductDraft>({ productIds: [] });
  const [, setIsVariableSalePrice] = useState(false);
  const [isLoadingCreationRows, setIsLoadingCreationRows] = useState(false);
  const [creationRowsError, setCreationRowsError] = useState("");
  const [databaseRows, setDatabaseRows] = useState<Record<string, Array<Record<string, unknown>>>>({});
  const [inventoryRows, setInventoryRows] = useState<InventorySummaryRow[]>([]);
  const [inventoryHistoryRows, setInventoryHistoryRows] = useState<InventoryHistoryRow[]>([]);
  const [selectedInventoryAdjustmentRow, setSelectedInventoryAdjustmentRow] = useState<InventorySummaryRow | null>(null);
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);
  const [isSavingInventoryAdjustment, setIsSavingInventoryAdjustment] = useState(false);
  const [inventoryError, setInventoryError] = useState("");
  const [inventoryAdjustmentStatus, setInventoryAdjustmentStatus] = useState<CreationStatus | null>(null);
  const [isInventoryEntryModalOpen, setIsInventoryEntryModalOpen] = useState(false);
  const [inventoryEntryWarehouseId, setInventoryEntryWarehouseId] = useState("");
  const [inventoryUsdToAwgRate, setInventoryUsdToAwgRate] = useState("1.79");
  const [inventoryEntryItems, setInventoryEntryItems] = useState<InventoryEntryDraftItem[]>(() => [
    createInventoryEntryDraftItem(),
  ]);
  const [isImportingInventoryExcel, setIsImportingInventoryExcel] = useState(false);
  const [inventoryExcelFileName, setInventoryExcelFileName] = useState("");
  const [isInventoryEntryItemModalOpen, setIsInventoryEntryItemModalOpen] = useState(false);
  const [inventoryEntryItemDraft, setInventoryEntryItemDraft] = useState({
    productId: "",
    quantity: "",
    costUsd: "",
    salePriceAwg: "",
    expirationDate: "",
    productWeightKg: "",
  });
  const [selectedInventoryEntryHistoryGroupId, setSelectedInventoryEntryHistoryGroupId] = useState("");
  const [inventoryEntryStatus, setInventoryEntryStatus] = useState<CreationStatus | null>(null);
  const [isSavingInventoryEntry, setIsSavingInventoryEntry] = useState(false);
  const [inventoryFilter, setInventoryFilter] = useState<"all" | "expiring-soon">("all");
  const [inventoryNameFilter, setInventoryNameFilter] = useState("");
  const [inventoryAdjustmentForm, setInventoryAdjustmentForm] = useState<InventoryAdjustmentFormState>(() =>
    createInitialInventoryAdjustmentForm(),
  );
  const [inventoryKpis, setInventoryKpis] = useState<InventorySummaryResponse["kpis"]>({
    totalProducts: 0,
    totalUnits: 0,
    totalInventoryCost: 0,
    expiringSoon: 0,
  });
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<SupplierOption[]>([]);
  const [salesRepOptions, setSalesRepOptions] = useState<SalesRepOption[]>([]);
  const [storeOptions, setStoreOptions] = useState<StoreOption[]>([]);
  const [warehouseOptions, setWarehouseOptions] = useState<WarehouseOption[]>([]);
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [warehouseLocations, setWarehouseLocations] = useState<WarehouseLocationRecord[]>([]);
  const [isLoadingWarehouseLocations, setIsLoadingWarehouseLocations] = useState(false);
  const [warehouseLocationError, setWarehouseLocationError] = useState("");
  const [warehouseLocationStatus, setWarehouseLocationStatus] = useState<CreationStatus | null>(null);
  const [isSavingWarehouseLocation, setIsSavingWarehouseLocation] = useState(false);
  const [editingWarehouseLocationId, setEditingWarehouseLocationId] = useState("");
  const [accountingView, setAccountingView] = useState<AccountingView>("overview");
  const [accountingModalKind, setAccountingModalKind] = useState<AccountingModalKind | null>(null);
  const [accountingStatuses, setAccountingStatuses] = useState<Record<string, CreationStatus>>({});
  const [accountingError, setAccountingError] = useState("");
  const [isLoadingAccounting, setIsLoadingAccounting] = useState(false);
  const [isSavingImportCost, setIsSavingImportCost] = useState(false);
  const [editingImportBatchReference, setEditingImportBatchReference] = useState("");
  const [selectedBillingBatchReference, setSelectedBillingBatchReference] = useState("");
  const [billingMarginPercent, setBillingMarginPercent] = useState("25");
  const [billingTrmCopPerUsd, setBillingTrmCopPerUsd] = useState("0");
  const [billingSaleOverrides, setBillingSaleOverrides] = useState<Record<string, string>>({});
  const [hasPendingBillingPricingChanges, setHasPendingBillingPricingChanges] = useState(false);
  const [editingBillingReference, setEditingBillingReference] = useState("");
  const [isLoadingBillingTrm, setIsLoadingBillingTrm] = useState(false);
  const [accountingFilters, setAccountingFilters] = useState<Record<string, SectionFilters>>({});
  const [accountingMonthFilter, setAccountingMonthFilter] = useState(() => new Date().toISOString().slice(0, 7));
  const [selectedAccountingMonthlyBatchKey, setSelectedAccountingMonthlyBatchKey] = useState("");
  const [importCostRows, setImportCostRows] = useState<ImportCostRecord[]>([]);
  const [fixedCostRows, setFixedCostRows] = useState<FixedCostRecord[]>([]);
  const [operationalExpenseRows, setOperationalExpenseRows] = useState<OperationalExpenseRecord[]>([]);
  // Logistics accounting state
  const [logisticsInvoices, setLogisticsInvoices] = useState<LogisticsInvoiceRecord[]>([]);
  const [logisticsBilledOrders, setLogisticsBilledOrders] = useState<LogisticsBilledOrderRecord[]>([]);
  const [logisticsFixedCosts, setLogisticsFixedCosts] = useState<LogisticsFixedCostRecord[]>([]);
  const [logisticsExpenses, setLogisticsExpenses] = useState<LogisticsExpenseRecord[]>([]);
  const [isLoadingLogisticsAccounting, setIsLoadingLogisticsAccounting] = useState(false);
  const [logisticsAccountingError, setLogisticsAccountingError] = useState("");
  const [logisticsAccountingMonthFilter, setLogisticsAccountingMonthFilter] = useState(() => new Date().toISOString().slice(0, 7));
  const [logisticsAccountingModalKind, setLogisticsAccountingModalKind] = useState<LogisticsAccountingModalKind | null>(null);
  const [logisticsAccountingStatuses, setLogisticsAccountingStatuses] = useState<Record<string, CreationStatus>>({});
  const [selectedLogisticsInvoiceId, setSelectedLogisticsInvoiceId] = useState<string | null>(null);
  const [logisticsInvoiceForm, setLogisticsInvoiceForm] = useState<LogisticsInvoiceFormState>(() => createInitialLogisticsInvoiceForm());
  const [containerImportForm, setContainerImportForm] = useState<ContainerImportFormState>(() =>
    createInitialContainerImportForm([]),
  );
  const [importContainerTemplates, setImportContainerTemplates] = useState<ImportContainerTemplateRecord[]>(() =>
    readPersistedImportContainerTemplates(),
  );
  const [selectedImportTemplateId, setSelectedImportTemplateId] = useState("");
  const [saveImportAsTemplate, setSaveImportAsTemplate] = useState(false);
  const [importTemplateName, setImportTemplateName] = useState("");
  const [warehouseLocationForm, setWarehouseLocationForm] = useState<WarehouseLocationFormState>(() =>
    createInitialWarehouseLocationForm(),
  );
  const [routes, setRoutes] = useState<SalesRouteRecord[]>([]);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false);
  const [routeStatus, setRouteStatus] = useState<CreationStatus | null>(null);
  const [routeError, setRouteError] = useState("");
  const [isSavingRoute, setIsSavingRoute] = useState(false);
  const [editingRouteId, setEditingRouteId] = useState("");
  const [routeForm, setRouteForm] = useState<RouteFormState>(() => createInitialRouteForm());
  const [sellerRoutes, setSellerRoutes] = useState<SalesRouteRecord[]>([]);
  const [isLoadingSellerRoutes, setIsLoadingSellerRoutes] = useState(false);
  const [sellerRoutesError, setSellerRoutesError] = useState("");
  const [selectedSellerRouteId, setSelectedSellerRouteId] = useState("");
  const [selectedSellerDayKey, setSelectedSellerDayKey] = useState<RouteDayKey | "">("");
  const [selectedSellerStoreId, setSelectedSellerStoreId] = useState("");
  const [sellerAssignedStore, setSellerAssignedStore] = useState<SellerAssignedStoreResponse["store"] | null>(null);
  const [sellerClientProducts, setSellerClientProducts] = useState<SellerClientProduct[]>([]);
  const [sellerClientProductsError, setSellerClientProductsError] = useState("");
  const [isLoadingSellerClientProducts, setIsLoadingSellerClientProducts] = useState(false);
  const [sellerOrders, setSellerOrders] = useState<SellerOrderRecord[]>([]);
  const [selectedSellerOrderDetail, setSelectedSellerOrderDetail] = useState<SellerOrderRecord | null>(null);
  const [selectedSellerOrderEdit, setSelectedSellerOrderEdit] = useState<SellerOrderRecord | null>(null);
  const [sellerOrderExpiredNotice, setSellerOrderExpiredNotice] = useState<SellerOrderRecord | null>(null);
  const [sellerOrdersError, setSellerOrdersError] = useState("");
  const [isLoadingSellerOrders, setIsLoadingSellerOrders] = useState(false);
  const [sellerOrderEditDraft, setSellerOrderEditDraft] = useState<SellerOrderEditDraft>({});
  const [sellerOrderEditStatus, setSellerOrderEditStatus] = useState<CreationStatus | null>(null);
  const [isSavingSellerOrderEdit, setIsSavingSellerOrderEdit] = useState(false);
  const [warehouseActiveSection, setWarehouseActiveSection] = useState<WarehouseActiveSection>("inventory");
  const [warehouseOrders, setWarehouseOrders] = useState<SellerOrderRecord[]>([]);
  const [warehouseOrdersError, setWarehouseOrdersError] = useState("");
  const [isLoadingWarehouseOrders, setIsLoadingWarehouseOrders] = useState(false);
  const [selectedWarehouseOrderDetail, setSelectedWarehouseOrderDetail] = useState<SellerOrderRecord | null>(null);
  const [warehouseOrderChecklist, setWarehouseOrderChecklist] = useState<Record<string, boolean>>({});
  const [warehouseOrderCompletionStatus, setWarehouseOrderCompletionStatus] = useState<CreationStatus | null>(null);
  const [isCompletingWarehouseOrder, setIsCompletingWarehouseOrder] = useState(false);
  const [sellerOrderDraft, setSellerOrderDraft] = useState<SellerOrderDraft>({});
  const [isSubmittingSellerOrder, setIsSubmittingSellerOrder] = useState(false);
  const [sellerOrderStatus, setSellerOrderStatus] = useState<CreationStatus | null>(null);
  const [productImage, setProductImage] = useState<ProductImageState>({
    previewUrl: "",
    uploadedUrl: "",
    isUploading: false,
    error: "",
  });
  const [productImageInputKey, setProductImageInputKey] = useState(0);
  const [catalogs, setCatalogs] = useState<CatalogRecord[]>([]);
  const [isLoadingCatalogs, setIsLoadingCatalogs] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [catalogStatus, setCatalogStatus] = useState<CreationStatus | null>(null);
  const [catalogPricingStatus, setCatalogPricingStatus] = useState<CreationStatus | null>(null);
  const [catalogWhatsappStatus, setCatalogWhatsappStatus] = useState<CreationStatus | null>(null);
  const [isSavingCatalog, setIsSavingCatalog] = useState(false);
  const [isSavingCatalogPricing, setIsSavingCatalogPricing] = useState(false);
  const [isSendingCatalogWhatsapp, setIsSendingCatalogWhatsapp] = useState(false);
  const [isCatalogWhatsappComposerOpen, setIsCatalogWhatsappComposerOpen] = useState(false);
  const [catalogWhatsappMessage, setCatalogWhatsappMessage] = useState("");
  const [catalogWhatsappAttachment, setCatalogWhatsappAttachment] = useState<CatalogWhatsappDraftAttachment | null>(null);
  const [isPreparingCatalogWhatsappAttachment, setIsPreparingCatalogWhatsappAttachment] = useState(false);
  const [editingCatalogId, setEditingCatalogId] = useState("");
  const [catalogForm, setCatalogForm] = useState<CatalogFormState>(() => createInitialCatalogForm());
  const [selectedCatalogId, setSelectedCatalogId] = useState("");
  const [selectedCatalogClientIds, setSelectedCatalogClientIds] = useState<string[]>([]);
  const [catalogPricingMarkup, setCatalogPricingMarkup] = useState("");
  const [catalogPreviewItems, setCatalogPreviewItems] = useState<CatalogPreviewItem[]>([]);
  const [isLoadingCatalogPreview, setIsLoadingCatalogPreview] = useState(false);
  const [catalogPreviewError, setCatalogPreviewError] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (sessionUser) {
      window.localStorage.setItem(sessionStorageKey, JSON.stringify(sessionUser));
      return;
    }

    window.localStorage.removeItem(sessionStorageKey);
  }, [sessionUser]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(containerImportTemplateStorageKey, JSON.stringify(importContainerTemplates));
  }, [importContainerTemplates]);

  const collectionConfigs = getCollectionConfigs(categoryOptions, supplierOptions);
  const selectedCollection =
    collectionConfigs.find((config) => config.key === activeSection) ?? collectionConfigs[0];
  const selectedWarehouse = warehouseOptions.find((warehouse) => warehouse.value === selectedWarehouseId) ?? null;
  const filteredInventoryBaseRows = inventoryFilter === "expiring-soon"
    ? inventoryRows.filter((row) => row.isExpiringSoon)
    : inventoryRows;
  const normalizedInventoryNameFilter = inventoryNameFilter.trim().toLowerCase();
  const filteredInventoryRows = normalizedInventoryNameFilter.length > 0
    ? filteredInventoryBaseRows.filter((row) => `${row.name} ${row.sku}`.toLowerCase().includes(normalizedInventoryNameFilter))
    : filteredInventoryBaseRows;
  const inventoryEntryHistoryGroups = Array.from(
    inventoryHistoryRows
      .filter((row) => row.movementType === "entry")
      .reduce((map, row) => {
        const fallbackEntryWarehouseName = "Bodega central";
        const fallbackUsdToAwgRate = 1.79;
        const normalizedGroupId = row.entryGroupId.trim();
        const legacyCreatedAt = new Date(row.createdAt);
        const legacyTimeBucket = Number.isNaN(legacyCreatedAt.getTime())
          ? String(row.createdAt).slice(0, 16)
          : legacyCreatedAt.toISOString().slice(0, 16);
        const legacyWarehouseKey = String(row.entryWarehouseId || "").trim() || "no-warehouse";
        const legacyRateKey = Number(row.entryUsdToAwgRate ?? 0) > 0 ? Number(row.entryUsdToAwgRate).toFixed(4) : "no-rate";
        const legacyReasonKey = String(row.reason || "").trim().toLowerCase() || "entry";
        const groupId = normalizedGroupId.length > 0
          ? normalizedGroupId
          : `legacy-entry-${legacyTimeBucket}-${legacyWarehouseKey}-${legacyRateKey}-${legacyReasonKey}`;
        const current = map.get(groupId) ?? {
          id: groupId,
          createdAt: row.createdAt,
          warehouseId: row.entryWarehouseId,
          warehouseName: row.entryWarehouseName || fallbackEntryWarehouseName,
          usdToAwgRate: Number(row.entryUsdToAwgRate ?? 0) > 0
            ? Number(row.entryUsdToAwgRate)
            : fallbackUsdToAwgRate,
          items: [],
          productCount: 0,
          totalUnits: 0,
        };

        current.items.push(row);
        current.productCount += 1;
        current.totalUnits += Number(row.quantity ?? 0);

        if (String(row.createdAt).localeCompare(String(current.createdAt)) > 0) {
          current.createdAt = row.createdAt;
        }

        if (!current.warehouseId && row.entryWarehouseId) {
          current.warehouseId = row.entryWarehouseId;
        }

        if (!current.warehouseName && row.entryWarehouseName) {
          current.warehouseName = row.entryWarehouseName;
        }

        if (!(current.usdToAwgRate > 0) && Number(row.entryUsdToAwgRate ?? 0) > 0) {
          current.usdToAwgRate = Number(row.entryUsdToAwgRate ?? 0);
        }

        map.set(groupId, current);
        return map;
      }, new Map<string, InventoryEntryHistoryGroup>())
      .values(),
  ).sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
  const selectedInventoryEntryHistoryGroup = inventoryEntryHistoryGroups.find((group) => group.id === selectedInventoryEntryHistoryGroupId) ?? null;
  const isCreationSection = creationSectionKeys.includes(activeSection as (typeof creationSectionKeys)[number]);
  const isEditingCreation = Boolean(editingRow && editingRow._id);
  const activeCreationSectionKey = (selectedCollection.key ?? defaultCollectionKey) as (typeof creationSectionKeys)[number];
  const creationRows = databaseRows[selectedCollection.key] ?? [];
  const currentSectionFilters = sectionFilters[selectedCollection.key] ?? createInitialSectionFilters();
  const [primaryFilter, secondaryFilter] = getCreationFilterDefinitions(activeCreationSectionKey);
  const creationSectionKpis = buildCreationKpis(activeCreationSectionKey, creationRows, warehouseLocations);
  const selectedCatalogRecord = catalogs.find((catalog) => catalog._id === selectedCatalogId) ?? null;
  const orderReadyCatalogs = catalogs.filter((catalog) => catalog.availableForOrders === true);
  const storeOptionsById = new Map(storeOptions.map((store) => [store.value, store]));
  const selectedCatalogClients = selectedCatalogClientIds
    .map((clientId) => storeOptionsById.get(clientId))
    .filter((store): store is StoreOption => Boolean(store));
  const userRoleLabel = sessionUser ? getRoleLabel(sessionUser.role) : "Acceso";
  const selectedSellerRoute = sellerRoutes.find((route) => (route._id ?? route.code) === selectedSellerRouteId) ?? null;
  const selectedSellerDay = selectedSellerRoute?.days.find((day) => day.day === selectedSellerDayKey) ?? null;
  const selectedSellerStores = selectedSellerDay?.stores ?? [];
  const selectedSellerStore = selectedSellerStores.find((store) => store.storeId === selectedSellerStoreId) ?? null;
  const selectedSellerRouteKey = selectedSellerRoute ? (selectedSellerRoute._id ?? selectedSellerRoute.code) : "";
  const visitedSellerStoreIds = new Set(
    sellerOrders
      .filter((order) => order.routeId === selectedSellerRouteKey && order.routeDay === selectedSellerDayKey)
      .map((order) => order.storeId),
  );
  const sellerDraftedItems = sellerClientProducts
    .map((product) => {
      const draft = sellerOrderDraft[product.productId] ?? { stockCurrent: "", quantity: "", notes: "" };
      const hasStockCurrent = draft.stockCurrent.trim().length > 0;
      const stockCurrent = hasStockCurrent ? Number(draft.stockCurrent) : null;

      return {
        productId: product.productId,
        stockCurrent,
        quantity: Number(draft.quantity || 0),
        notes: draft.notes.trim(),
      };
    })
    .filter((item) => (item.stockCurrent !== null && Number.isFinite(item.stockCurrent) && item.stockCurrent >= 0) || (Number.isFinite(item.quantity) && item.quantity > 0));
  const inventoryRowsByProductId = new Map(inventoryRows.map((row) => [row.productId, row]));
  const productOptionsById = new Map(productOptions.map((product) => [product.value, product]));
  const warehouseOrderClient = selectedWarehouseOrderDetail
    ? storeOptionsById.get(selectedWarehouseOrderDetail.storeId) ?? null
    : null;
  const warehousePricedItems = selectedWarehouseOrderDetail
    ? selectedWarehouseOrderDetail.items.map((item) => {
      const catalogItem = catalogPreviewItems.find((previewItem) => previewItem.productId === item.productId);
      const productOption = productOptionsById.get(item.productId);
      const resolvedSalePrice = roundCurrencyValue(Number(catalogItem?.salePrice ?? productOption?.salePrice ?? 0));

      return {
        ...item,
        resolvedSalePrice,
        lineTotal: roundCurrencyValue(resolvedSalePrice * Number(item.quantity ?? 0)),
        priceSource: catalogItem
          ? "catalog"
          : productOption?.variableSalePrice
            ? "variable"
            : "product",
      };
    })
    : [];
  const warehouseInvoiceTotal = warehousePricedItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const warehouseFallbackPriceCount = warehousePricedItems.filter((item) => item.priceSource !== "catalog").length;
  const warehouseReceivedOrders = warehouseOrders.filter((order) => order.status !== "delivered");
  const warehouseCompletedOrders = warehouseOrders.filter((order) => order.status === "delivered");
  const warehouseAllItemsChecked = selectedWarehouseOrderDetail
    ? selectedWarehouseOrderDetail.items.length > 0
      && selectedWarehouseOrderDetail.items.every((item) => Boolean(warehouseOrderChecklist[item.productId]))
    : false;
  const selectedClientDraftProducts = clientProductDraft.productIds
    .map((productId) => productOptionsById.get(productId))
    .filter((product): product is ProductOption => Boolean(product));
  const importCostFilters = accountingFilters.importCosts ?? createInitialSectionFilters();
  const fixedCostFilters = accountingFilters.fixedCosts ?? createInitialSectionFilters();
  const operationalExpenseFilters = accountingFilters.operationalExpenses ?? createInitialSectionFilters();
  const importBatchRows = Array.from(
    importCostRows.reduce((map, row) => {
      const key = row.containerReference ?? `${row.shipmentReference ?? "sin-envio"}-${String(row.importDate).slice(0, 10)}`;
      const current = map.get(key);

      if (current) {
        current.totalImportCost += Number(row.totalImportCost ?? 0);
        return map;
      }

      map.set(key, {
        containerReference: row.containerReference ?? key,
        containerSize: row.containerSize ?? "20ft",
        shipmentReference: row.shipmentReference ?? "",
        importDate: row.importDate,
        totalImportCost: Number(row.totalImportCost ?? 0),
      });
      return map;
    }, new Map<string, ImportBatchSummaryRow>()),
  ).sort(([, left], [, right]) => String(right.importDate).localeCompare(String(left.importDate))).map(([, row]) => row);
  const importContainerCount = new Set(
    importCostRows.map((row) => row.containerReference ?? `${row.productId}-${String(row.importDate).slice(0, 10)}`),
  ).size;
  const containerImportProductsById = new Map(
    containerImportForm.products.map((product) => [product.productId, product]),
  );
  const containerProductMetrics = productOptions.reduce<
    Array<{
      product: ProductOption;
      currentProduct: ContainerImportProductFormState;
      boxCount: number;
      importedQuantity: number;
      unitsPerBox: number;
      unitWeightKg: number;
      estimatedWeightKg: number;
      boxVolumeCubicMeters: number;
      estimatedBoxes: number;
      estimatedVolumeCubicMeters: number;
      hasVolumeConfig: boolean;
      hasWeightConfig: boolean;
    }>
  >((metrics, product) => {
    const currentProduct = containerImportProductsById.get(product.value);

    if (!currentProduct) {
      return metrics;
    }

    const importedQuantity = Number(currentProduct.importedQuantity || 0);
    const unitsPerBox = Number(product.unitsPerBox || 0);
    const unitWeightKg = Number(product.productWeightKg || 0);
    const boxVolumeCubicMeters = calculateProductBoxVolumeCubicMeters(product);
    const estimatedBoxes = calculateEstimatedBoxes(importedQuantity, unitsPerBox);

    metrics.push({
      product,
      currentProduct,
      boxCount: Number(currentProduct.boxCount || 0),
      importedQuantity,
      unitsPerBox,
      unitWeightKg,
      estimatedWeightKg: importedQuantity * unitWeightKg,
      boxVolumeCubicMeters,
      estimatedBoxes,
      estimatedVolumeCubicMeters: estimatedBoxes * boxVolumeCubicMeters,
      hasVolumeConfig: unitsPerBox > 0 && boxVolumeCubicMeters > 0,
      hasWeightConfig: unitWeightKg > 0,
    });

    return metrics;
  }, []);
  const selectedContainerImportProducts = containerImportForm.products.filter((product) => product.selected);
  const selectedContainerCapacityCubicMeters = getContainerCapacityCubicMeters(containerImportForm.containerSize);
  const selectedContainerCapacityKilograms = getContainerCapacityKilograms(containerImportForm.containerSize);
  const isContainerMeasurementKg = containerImportForm.measurementUnit === "kg";
  const selectedContainerVolumeMetrics = containerProductMetrics.filter((metric) => metric.currentProduct.selected);
  const selectedContainerImportQuantity = selectedContainerImportProducts.reduce(
    (sum, product) => sum + Number(product.importedQuantity || 0),
    0,
  );
  const selectedContainerImportOriginTotal = selectedContainerImportProducts.reduce(
    (sum, product) =>
      sum + Number(product.importedQuantity || 0) * Number(product.purchaseUnitCostOrigin || 0),
    0,
  );
  // Adjusted total using box cost when available (mirrors backend allocation logic)
  const savedImportExpenses = containerImportForm.expenseItems.filter((e) => e.saved);
  const selectedContainerAdjustedMerchandiseCost = containerProductMetrics
    .filter((m) => m.currentProduct.selected && m.importedQuantity > 0)
    .reduce((sum, m) => {
      const boxCost = Number(m.currentProduct.purchaseBoxCostOrigin || 0);
      const unitCost = Number(m.currentProduct.purchaseUnitCostOrigin || 0);
      const adjustedUnit = boxCost > 0 && m.unitsPerBox > 0 ? boxCost / m.unitsPerBox : unitCost;
      return sum + adjustedUnit * m.importedQuantity;
    }, 0);
  const containerGeneralCostsTotal = containerImportForm.expenseItems.reduce(
    (sum, expense) => sum + Number(expense.amount || 0),
    0,
  );
  const selectedContainerUsedCubicMeters = selectedContainerVolumeMetrics.reduce(
    (sum, metric) => sum + metric.estimatedVolumeCubicMeters,
    0,
  );
  const selectedContainerCapacityByUnit = isContainerMeasurementKg
    ? selectedContainerCapacityKilograms
    : containerImportForm.measurementUnit === "pie3"
      ? selectedContainerCapacityCubicMeters * cubicFeetPerCubicMeter
      : selectedContainerCapacityCubicMeters;
  const selectedContainerUsedByUnit = isContainerMeasurementKg
    ? selectedContainerVolumeMetrics.reduce((sum, metric) => sum + metric.estimatedWeightKg, 0)
    : containerImportForm.measurementUnit === "pie3"
      ? selectedContainerUsedCubicMeters * cubicFeetPerCubicMeter
      : selectedContainerUsedCubicMeters;
  const selectedContainerRemainingByUnit = selectedContainerCapacityByUnit - selectedContainerUsedByUnit;
  const selectedContainerOverflowByUnit = Math.max(selectedContainerUsedByUnit - selectedContainerCapacityByUnit, 0);
  const selectedContainerFillPercentage = selectedContainerCapacityByUnit > 0
    ? Math.min((selectedContainerUsedByUnit / selectedContainerCapacityByUnit) * 100, 100)
    : 0;
  const selectedContainerMetricsWithoutVolume = selectedContainerVolumeMetrics.filter((metric) => {
    if (!(metric.importedQuantity > 0)) {
      return false;
    }

    if (isContainerMeasurementKg) {
      return !metric.hasWeightConfig;
    }

    return !metric.hasVolumeConfig;
  });
  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const accountingKpis: KpiCard[] = [
    { label: "Costos fijos registrados", value: fixedCostRows.length, tone: "cyan" },
    {
      label: "Costos fijos mensuales",
      value: Number(fixedCostRows.reduce((sum, row) => sum + normalizeMonthlyAmount(row.amount, row.frequency), 0).toFixed(0)),
      tone: "amber",
    },
    {
      label: "Gastos operativos registrados",
      value: operationalExpenseRows.length,
      tone: "slate",
    },
    {
      label: "Gastos operativos del mes",
      value: Number(
        operationalExpenseRows
          .filter((row) => String(row.expenseDate).slice(0, 7) === currentMonthKey)
          .reduce((sum, row) => sum + row.amount, 0)
          .toFixed(0),
      ),
      tone: "cyan",
    },
  ];
  const importSectionKpis: KpiCard[] = [
    { label: "Contenedores importados", value: importContainerCount, tone: "cyan" },
    {
      label: "Costo unitario real promedio",
      value: Number(
        importCostRows.length
          ? (importCostRows.reduce((sum, row) => sum + row.landedUnitCost, 0) / importCostRows.length).toFixed(0)
          : 0,
      ),
      tone: "amber",
    },
    {
      label: "Productos importados",
      value: new Set(importCostRows.map((row) => row.productId)).size,
      tone: "slate",
    },
    {
      label: "Unidades importadas",
      value: importCostRows.reduce((sum, row) => sum + row.importedQuantity, 0),
      tone: "cyan",
    },
  ];
  const filteredImportBatchRows = importBatchRows.filter((row) => {
    const matchesSearch =
      importCostFilters.search.trim().length === 0 ||
      `${row.containerReference ?? ""} ${row.shipmentReference ?? ""} ${formatContainerSize(row.containerSize ?? "20ft")}`
        .toLowerCase()
        .includes(importCostFilters.search.trim().toLowerCase());
    const matchesPrimary =
      importCostFilters.primary.trim().length === 0 ||
      `${row.containerReference ?? ""} ${row.shipmentReference ?? ""}`.toLowerCase().includes(importCostFilters.primary.trim().toLowerCase());
    const matchesSecondary =
      importCostFilters.secondary.trim().length === 0 ||
      String(row.importDate).slice(0, 7).includes(importCostFilters.secondary.trim());

    return matchesSearch && matchesPrimary && matchesSecondary;
  });
  const filteredFixedCostRows = fixedCostRows.filter((row) => {
    const matchesSearch =
      fixedCostFilters.search.trim().length === 0 ||
      row.name.toLowerCase().includes(fixedCostFilters.search.trim().toLowerCase());
    const matchesPrimary =
      fixedCostFilters.primary.trim().length === 0 ||
      row.category.toLowerCase().includes(fixedCostFilters.primary.trim().toLowerCase());
    const matchesSecondary =
      fixedCostFilters.secondary.trim().length === 0 ||
      row.frequency.toLowerCase().includes(fixedCostFilters.secondary.trim().toLowerCase());

    return matchesSearch && matchesPrimary && matchesSecondary;
  });
  const filteredOperationalExpenseRows = operationalExpenseRows.filter((row) => {
    const matchesSearch =
      operationalExpenseFilters.search.trim().length === 0 ||
      row.name.toLowerCase().includes(operationalExpenseFilters.search.trim().toLowerCase());
    const matchesPrimary =
      operationalExpenseFilters.primary.trim().length === 0 ||
      row.category.toLowerCase().includes(operationalExpenseFilters.primary.trim().toLowerCase());
    const matchesSecondary =
      operationalExpenseFilters.secondary.trim().length === 0 ||
      String(row.expenseDate).slice(0, 7).includes(operationalExpenseFilters.secondary.trim());

    return matchesSearch && matchesPrimary && matchesSecondary;
  });
  const billingBatchRows = importBatchRows.map((row) => ({
    ...row,
    referenceKey: row.containerReference ?? `${row.shipmentReference ?? "sin-envio"}-${String(row.importDate).slice(0, 10)}`,
  }));
  const selectedBillingReference = selectedBillingBatchReference || billingBatchRows[0]?.referenceKey || "";
  const selectedBillingRows = importCostRows.filter((row) => {
    const rowReference = row.containerReference ?? `${row.shipmentReference ?? "sin-envio"}-${String(row.importDate).slice(0, 10)}`;
    return rowReference === selectedBillingReference;
  });
  const selectedBillingBatch = billingBatchRows.find((row) => row.referenceKey === selectedBillingReference) ?? null;
  const billingMarginValue = Number(billingMarginPercent || 0);
  const billingTrmValue = parseDecimalInput(billingTrmCopPerUsd);
  const selectedBillingPricingLocked = selectedBillingRows.length > 0
    && selectedBillingRows.every((row) => Boolean(row.invoiceGeneratedAt));
  const isBillingPricingEditable = selectedBillingRows.length > 0
    && (!selectedBillingPricingLocked || editingBillingReference === selectedBillingReference);
  const showBillingPurchaseColumn = selectedBillingRows.some((row) => Number(row.purchaseUnitCostOrigin || 0) > 0);
  const showBillingFreightColumn = selectedBillingRows.some((row) => Number(row.freightCost || 0) > 0);
  const showBillingCustomsColumn = selectedBillingRows.some((row) => Number(row.customsCost || 0) > 0);
  const showBillingInlandColumn = selectedBillingRows.some((row) => Number(row.inlandLogisticsCost || 0) > 0);
  const showBillingTaxesColumn = selectedBillingRows.some((row) => Number(row.taxesCost || 0) > 0);
  const showBillingOthersColumn = selectedBillingRows.some((row) => Number(row.otherImportCosts || 0) > 0);
  const billingVisibleColumnCount =
    5
    + (showBillingPurchaseColumn ? 1 : 0)
    + (showBillingFreightColumn ? 1 : 0)
    + (showBillingCustomsColumn ? 1 : 0)
    + (showBillingInlandColumn ? 1 : 0)
    + (showBillingTaxesColumn ? 1 : 0)
    + (showBillingOthersColumn ? 1 : 0);
  const normalizedAccountingMonthFilter = accountingMonthFilter.trim();
  const monthlyImportRows = importCostRows.filter((row) => (
    normalizedAccountingMonthFilter.length === 0
      ? true
      : String(row.importDate).slice(0, 7) === normalizedAccountingMonthFilter
  ));
  const dashboardCurrentMonthImportRows = importCostRows.filter((row) => String(row.importDate).slice(0, 7) === currentMonthKey);
  const monthlyImportBatchRows = Array.from(
    monthlyImportRows.reduce((map, row) => {
      const key = row.containerReference
        || `${row.shipmentReference ?? "sin-envio"}-${String(row.importDate).slice(0, 10)}`;
      const current = map.get(key) ?? {
        key,
        importDate: row.importDate,
        containerReference: row.containerReference ?? key,
        containerSize: row.containerSize ?? "20ft",
        shipmentReference: row.shipmentReference ?? "",
        totalQuantity: 0,
        totalImportCost: 0,
        totalProjectedRevenue: 0,
        totalProjectedUtility: 0,
        items: [] as ImportCostRecord[],
      };

      const rowTotalCost = Number(row.totalImportCost ?? 0);
      const rowInvoicedRevenue = Number(row.invoicedLineTotalCop ?? 0) > 0
        ? Number(row.invoicedLineTotalCop ?? 0)
        : rowTotalCost;
      const rowInvoicedUtility = Number(row.invoicedLineUtilityCop ?? 0);

      current.totalQuantity += Number(row.importedQuantity ?? 0);
      current.totalImportCost += rowTotalCost;
      current.totalProjectedRevenue += rowInvoicedRevenue;
      current.totalProjectedUtility += rowInvoicedUtility;
      current.items.push(row);

      map.set(key, current);
      return map;
    }, new Map<string, {
      key: string;
      importDate: string;
      containerReference: string;
      containerSize: string;
      shipmentReference: string;
      totalQuantity: number;
      totalImportCost: number;
      totalProjectedRevenue: number;
      totalProjectedUtility: number;
      items: ImportCostRecord[];
    }>()),
  ).map(([, value]) => value)
    .sort((left, right) => String(right.importDate).localeCompare(String(left.importDate)));
  const monthlyImportBatchCount = monthlyImportBatchRows.length;
  const selectedAccountingMonthlyBatch = monthlyImportBatchRows.find((row) => row.key === selectedAccountingMonthlyBatchKey) ?? null;
  const monthlyImportCostTotal = monthlyImportRows.reduce((sum, row) => sum + Number(row.totalImportCost ?? 0), 0);
  const monthlyImportUnits = monthlyImportRows.reduce((sum, row) => sum + Number(row.importedQuantity ?? 0), 0);
  const monthlyProjectedRevenueCop = monthlyImportRows.reduce((sum, row) => {
    const lineTotal = Number(row.invoicedLineTotalCop ?? 0);
    return sum + (lineTotal > 0 ? lineTotal : Number(row.totalImportCost ?? 0));
  }, 0);
  const monthlyProjectedUtilityCop = monthlyImportRows.reduce((sum, row) => sum + Number(row.invoicedLineUtilityCop ?? 0), 0);
  const monthlyFixedAdditionalCosts = fixedCostRows.reduce(
    (sum, row) => sum + getFixedCostAmountForMonth(row, normalizedAccountingMonthFilter),
    0,
  );
  const monthlyOperationalAdditionalCosts = operationalExpenseRows
    .filter((row) => String(row.expenseDate).slice(0, 7) === normalizedAccountingMonthFilter)
    .reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const monthlyAdditionalCostsTotal = monthlyFixedAdditionalCosts + monthlyOperationalAdditionalCosts;
  const monthlyProjectedNetUtilityCop = monthlyProjectedUtilityCop - monthlyAdditionalCostsTotal;

  // Logistics accounting computed values (AWG)
  const normalizedLogisticsMonthFilter = logisticsAccountingMonthFilter.trim();
  const logisticsMonthlyInvoices = logisticsInvoices.filter((inv) =>
    normalizedLogisticsMonthFilter.length === 0
      ? true
      : String(inv.invoiceDate).slice(0, 7) === normalizedLogisticsMonthFilter,
  );
  const logisticsMonthlyBilledOrders = logisticsBilledOrders.filter((order) =>
    normalizedLogisticsMonthFilter.length === 0
      ? true
      : String(order.invoiceDate).slice(0, 7) === normalizedLogisticsMonthFilter,
  );
  const logisticsMonthlyRevenue = logisticsMonthlyInvoices.reduce((sum, inv) => sum + Number(inv.totalRevenueAwg ?? 0), 0);
  const logisticsMonthlyUtility = logisticsMonthlyInvoices.reduce((sum, inv) => sum + Number(inv.totalUtilityAwg ?? 0), 0);
  const logisticsMonthlyFixedCosts = logisticsFixedCosts.reduce((sum, fc) => {
    const startMonth = String(fc.startDate ?? "").slice(0, 7);
    if (fc.frequency === "one-time") return sum + (startMonth === normalizedLogisticsMonthFilter ? Number(fc.amountAwg ?? 0) : 0);
    return sum + normalizeMonthlyAmount(Number(fc.amountAwg ?? 0), fc.frequency);
  }, 0);
  const logisticsMonthlyExpenses = logisticsExpenses
    .filter((ex) => String(ex.expenseDate).slice(0, 7) === normalizedLogisticsMonthFilter)
    .reduce((sum, ex) => sum + Number(ex.amountAwg ?? 0), 0);
  const logisticsMonthlyAdditionalCosts = logisticsMonthlyFixedCosts + logisticsMonthlyExpenses;
  const logisticsMonthlyNetUtility = logisticsMonthlyUtility - logisticsMonthlyAdditionalCosts;
  const selectedLogisticsInvoice = logisticsInvoices.find((inv) => inv._id === selectedLogisticsInvoiceId) ?? null;
  const dashboardCurrentMonthArubaRows = logisticsBilledOrders.filter((row) => String(row.invoiceDate).slice(0, 7) === currentMonthKey);
  const dashboardArubaMonthlySalesAwg = dashboardCurrentMonthArubaRows.reduce((sum, row) => sum + Number(row.totalRevenueAwg ?? 0), 0);
  const dashboardArubaMonthlyUtilityAwg = dashboardCurrentMonthArubaRows.reduce((sum, row) => sum + Number(row.totalUtilityAwg ?? 0), 0);
  const dashboardColombiaMonthlySalesCop = dashboardCurrentMonthImportRows.reduce((sum, row) => {
    const lineTotal = Number(row.invoicedLineTotalCop ?? 0);
    return sum + (lineTotal > 0 ? lineTotal : Number(row.totalImportCost ?? 0));
  }, 0);
  const dashboardColombiaMonthlyUtilityCop = dashboardCurrentMonthImportRows.reduce((sum, row) => sum + Number(row.invoicedLineUtilityCop ?? 0), 0);
  const dashboardDeliveredOrders = warehouseOrders.filter((order) => order.status === "delivered");
  const dashboardSoldProducts = Array.from(
    dashboardDeliveredOrders.reduce((map, order) => {
      order.items.forEach((item) => {
        const current = map.get(item.productId) ?? {
          productId: item.productId,
          productName: item.productName,
          productSku: item.productSku,
          totalUnits: 0,
        };

        current.totalUnits += Number(item.quantity ?? 0);
        map.set(item.productId, current);
      });

      return map;
    }, new Map<string, DashboardProductSalesRow>()),
  )
    .map(([, value]) => value)
    .filter((row) => row.totalUnits > 0)
    .sort((left, right) => right.totalUnits - left.totalUnits || left.productName.localeCompare(right.productName));
  const dashboardTopSellingProducts = dashboardSoldProducts.slice(0, 5);
  const dashboardLowestSellingProducts = [...dashboardSoldProducts]
    .sort((left, right) => left.totalUnits - right.totalUnits || left.productName.localeCompare(right.productName))
    .slice(0, 5);
  const dashboardExpiringProducts = inventoryRows
    .filter((row) => row.isExpiringSoon && row.expirationDate)
    .sort((left, right) => String(left.expirationDate).localeCompare(String(right.expirationDate)))
    .slice(0, 5);
  const dashboardClientBilling = Array.from(
    logisticsBilledOrders.reduce((map, order) => {
      const current = map.get(order.storeName) ?? {
        clientName: order.storeName,
        invoiceCount: 0,
        totalRevenue: 0,
      };

      current.invoiceCount += 1;
      current.totalRevenue += Number(order.totalRevenueAwg ?? 0);
      map.set(order.storeName, current);
      return map;
    }, new Map<string, DashboardClientBillingRow>()),
  )
    .map(([, value]) => value)
    .sort((left, right) => right.totalRevenue - left.totalRevenue || left.clientName.localeCompare(right.clientName));
  const dashboardTopBillingClients = dashboardClientBilling.slice(0, 5);
  const dashboardLowestBillingClients = [...dashboardClientBilling]
    .sort((left, right) => left.totalRevenue - right.totalRevenue || left.clientName.localeCompare(right.clientName))
    .slice(0, 5);
  const hiddenDashboardKpis = new Set(["Usuarios activos", "Categorias", "Proveedores", "Bodegas"]);
  const dashboardExecutiveCards: DashboardExecutiveCard[] = [
    ...kpis.flatMap((card) => {
      if (hiddenDashboardKpis.has(card.label)) {
        return [];
      }

      const label = card.label === "Rutas semanales" ? "Rutas asignadas" : card.label;

      return [{
        label,
        valueLabel: String(card.value),
        tone: card.tone,
        targetSection: dashboardKpiSectionMap[label],
      }];
    }),
    {
      label: "Stock en bodega (AWG)",
      valueLabel: formatAwgCurrency(inventoryKpis.totalInventoryCost),
      tone: "cyan",
      targetSection: "inventory",
    },
    {
      label: "Ventas del mes Aruba (AWG)",
      valueLabel: formatAwgCurrency(dashboardArubaMonthlySalesAwg),
      tone: "amber",
      targetSection: dashboardKpiSectionMap["Ventas del mes Aruba (AWG)"],
    },
    {
      label: "Utilidad del mes Aruba (AWG)",
      valueLabel: formatAwgCurrency(dashboardArubaMonthlyUtilityAwg),
      tone: "slate",
      targetSection: dashboardKpiSectionMap["Utilidad del mes Aruba (AWG)"],
    },
    {
      label: "Ventas del mes Colombia (COP)",
      valueLabel: formatCurrency(dashboardColombiaMonthlySalesCop),
      tone: "amber",
      targetSection: dashboardKpiSectionMap["Ventas del mes Colombia (COP)"],
    },
    {
      label: "Utilidad del mes Colombia (COP)",
      valueLabel: formatCurrency(dashboardColombiaMonthlyUtilityCop),
      tone: "slate",
      targetSection: dashboardKpiSectionMap["Utilidad del mes Colombia (COP)"],
    },
  ];

  function getBillingRowKey(row: ImportCostRecord, index: number) {
    return `${selectedBillingReference}-${row._id ?? `${row.productId}-${row.importDate}-${index}`}`;
  }

  function getSuggestedBillingSaleUsd(row: ImportCostRecord) {
    const totalUnitCop = Number(row.landedUnitCost || 0);
    const saleUnitCop = totalUnitCop * (1 + Math.max(billingMarginValue, 0) / 100);
    const saleUnitUsd = billingTrmValue > 0 ? saleUnitCop / billingTrmValue : 0;

    return Number.isFinite(saleUnitUsd) ? (Math.round(saleUnitUsd * 100) / 100).toFixed(2) : "";
  }

  function getEffectiveBillingSaleUsd(row: ImportCostRecord, index: number) {
    const rowKey = getBillingRowKey(row, index);
    const persistedSaleUsd = Number(row.invoicedSaleUnitUsd ?? 0);

    if (billingSaleOverrides[rowKey] !== undefined) {
      return billingSaleOverrides[rowKey];
    }

    if (Number.isFinite(persistedSaleUsd) && persistedSaleUsd > 0) {
      return persistedSaleUsd.toFixed(2);
    }

    return getSuggestedBillingSaleUsd(row);
  }

  function applyBillingMarginToRows() {
    if (!isBillingPricingEditable) {
      return;
    }

    setBillingSaleOverrides((current) => {
      const next = { ...current };

      selectedBillingRows.forEach((row, index) => {
        const rowKey = getBillingRowKey(row, index);
        next[rowKey] = getSuggestedBillingSaleUsd(row);
      });

      return next;
    });
    setHasPendingBillingPricingChanges(true);
  }

  const filteredCreationRows = creationRows.filter((row) => {
    const globalSearch = currentSectionFilters.search.trim().toLowerCase();
    const primarySearch = currentSectionFilters.primary.trim().toLowerCase();
    const secondarySearch = currentSectionFilters.secondary.trim().toLowerCase();
    const searchableRow = selectedCollection.tableColumns
      .map((column) => getNormalizedRowValue(row, column.key))
      .join(" ");
    const searchableTokens = searchableRow.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    const globalTerms = globalSearch.split(/\s+/).filter(Boolean);

    const matchesGlobal =
      globalTerms.length === 0 ||
      globalTerms.every((term) => searchableTokens.some((token) => token.startsWith(term)));
    const matchesPrimary =
      primarySearch.length === 0 || getNormalizedRowValue(row, primaryFilter.key).includes(primarySearch);
    const matchesSecondary =
      secondarySearch.length === 0 || getNormalizedRowValue(row, secondaryFilter.key).includes(secondarySearch);

    return matchesGlobal && matchesPrimary && matchesSecondary;
  });

  useEffect(() => {
    setContainerImportForm((current) => ({
      ...current,
      products: buildContainerImportProducts(productOptions, current.products),
    }));
  }, [productOptions]);

  useEffect(() => {
    if (activeSection !== "imports") {
      setAccountingView("overview");
    }
  }, [activeSection]);

  useEffect(() => {
    if (sessionUser?.role !== "management") {
      return;
    }

    async function fetchKpis() {
      try {
        setIsLoadingKpis(true);
        const response = await fetch(`${apiBaseUrl}/management/kpis`);
        const data = (await response.json()) as { cards: KpiCard[] };
        setKpis(data.cards);
      } finally {
        setIsLoadingKpis(false);
      }
    }

    void fetchKpis();
  }, [sessionUser]);

  useEffect(() => {
    if (sessionUser?.role !== "management" && sessionUser?.role !== "warehouse-aruba") {
      return;
    }

    void refreshReferenceOptions();
  }, [sessionUser]);

  useEffect(() => {
    if (sessionUser?.role !== "warehouse-aruba") {
      return;
    }

    void refreshCatalogs();
  }, [sessionUser, warehouseActiveSection]);

  useEffect(() => {
    if (sessionUser?.role !== "management" || !isCreationSection) {
      return;
    }

    void refreshCreationRows(selectedCollection);
  }, [isCreationSection, selectedCollection.endpoint, selectedCollection.key, sessionUser]);

  useEffect(() => {
    if (sessionUser?.role !== "management" || activeSection !== "warehouses") {
      return;
    }

    if (!selectedWarehouseId) {
      setWarehouseLocations([]);
      setWarehouseLocationError(warehouseOptions.length === 0 ? "Primero crea una bodega en esta seccion." : "Selecciona una bodega para organizarla.");
      return;
    }

    async function fetchWarehouseLocations() {
      try {
        setIsLoadingWarehouseLocations(true);
        setWarehouseLocationError("");
        const response = await fetch(
          `${apiBaseUrl}/management/warehouse-locations?warehouseId=${encodeURIComponent(selectedWarehouseId)}`,
        );
        const data = (await response.json()) as Array<WarehouseLocationRecord> | { message?: string };

        if (!response.ok || !Array.isArray(data)) {
          setWarehouseLocationError(
            Array.isArray(data)
              ? "No fue posible cargar la organizacion de la bodega."
              : data.message ?? "No fue posible cargar la organizacion de la bodega.",
          );
          return;
        }

        setWarehouseLocations(data);
      } catch {
        setWarehouseLocationError("No fue posible conectar con el backend.");
      } finally {
        setIsLoadingWarehouseLocations(false);
      }
    }

    void fetchWarehouseLocations();
  }, [activeSection, selectedWarehouseId, sessionUser, warehouseOptions.length]);

  useEffect(() => {
    if (sessionUser?.role !== "management" || activeSection !== "routes") {
      return;
    }

    async function fetchRoutes() {
      try {
        setIsLoadingRoutes(true);
        setRouteError("");
        const response = await fetch(`${apiBaseUrl}/management/routes`);
        const data = (await response.json()) as Array<SalesRouteRecord> | { message?: string };

        if (!response.ok || !Array.isArray(data)) {
          setRouteError(Array.isArray(data) ? "No fue posible cargar las rutas." : data.message ?? "No fue posible cargar las rutas.");
          return;
        }

        setRoutes(data);
        setDatabaseRows((current) => ({
          ...current,
          routes: data as Array<Record<string, unknown>>,
        }));
      } catch {
        setRouteError("No fue posible conectar con el backend.");
      } finally {
        setIsLoadingRoutes(false);
      }
    }

    void fetchRoutes();
  }, [activeSection, sessionUser]);

  useEffect(() => {
    const canAccessAccounting = sessionUser?.role === "management" || sessionUser?.role === "colombia-ops";

    if (!canAccessAccounting || (activeSection !== "accounting" && activeSection !== "imports" && activeSection !== "import-billing" && activeSection !== "dashboard")) {
      return;
    }

    void refreshAccountingData();
  }, [activeSection, sessionUser]);

  useEffect(() => {
    const canAccessLogisticsAccounting = sessionUser?.role === "management" || sessionUser?.role === "warehouse-aruba";

    if (!canAccessLogisticsAccounting || (activeSection !== "logistics-accounting" && activeSection !== "dashboard")) {
      return;
    }

    void refreshLogisticsAccountingData();
  }, [activeSection, sessionUser]);

  useEffect(() => {
    const canAccessBilling = sessionUser?.role === "management" || sessionUser?.role === "colombia-ops";

    if (activeSection !== "import-billing" || !canAccessBilling) {
      return;
    }

    if (billingBatchRows.length === 0) {
      setSelectedBillingBatchReference("");
      return;
    }

    if (!billingBatchRows.some((row) => row.referenceKey === selectedBillingBatchReference)) {
      setSelectedBillingBatchReference(billingBatchRows[0].referenceKey);
    }
  }, [activeSection, billingBatchRows, selectedBillingBatchReference, sessionUser]);

  useEffect(() => {
    const canAccessBilling = sessionUser?.role === "management" || sessionUser?.role === "colombia-ops";

    if (activeSection !== "import-billing" || !canAccessBilling) {
      return;
    }

    let isCancelled = false;

    async function fetchDailyTrm() {
      try {
        setIsLoadingBillingTrm(true);
        const response = await fetch("https://open.er-api.com/v6/latest/USD");
        const data = (await response.json()) as { rates?: { COP?: number } };
        const nextRate = Number(data?.rates?.COP ?? 0);

        if (isCancelled) {
          return;
        }

        if (Number.isFinite(nextRate) && nextRate > 0) {
          setBillingTrmCopPerUsd(String(Math.round(nextRate * 100) / 100));
          return;
        }

        setBillingTrmCopPerUsd((current) => (Number(current || 0) > 0 ? current : "4100"));
      } catch {
        if (!isCancelled) {
          setBillingTrmCopPerUsd((current) => (Number(current || 0) > 0 ? current : "4100"));
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingBillingTrm(false);
        }
      }
    }

    void fetchDailyTrm();

    return () => {
      isCancelled = true;
    };
  }, [activeSection, sessionUser]);

  useEffect(() => {
    if (!selectedBillingReference) {
      setEditingBillingReference("");
      setHasPendingBillingPricingChanges(false);
      return;
    }

    if (editingBillingReference && editingBillingReference !== selectedBillingReference) {
      setEditingBillingReference("");
      setHasPendingBillingPricingChanges(false);
    }
  }, [editingBillingReference, selectedBillingReference]);

  useEffect(() => {
    if (!selectedAccountingMonthlyBatchKey) {
      return;
    }

    if (!monthlyImportBatchRows.some((row) => row.key === selectedAccountingMonthlyBatchKey)) {
      setSelectedAccountingMonthlyBatchKey("");
    }
  }, [monthlyImportBatchRows, selectedAccountingMonthlyBatchKey]);

  useEffect(() => {
    if (sessionUser?.role !== "management" || activeSection !== "catalog") {
      return;
    }

    void refreshCatalogs();
  }, [activeSection, sessionUser]);

  useEffect(() => {
    if (sessionUser?.role !== "management" || activeSection !== "catalog") {
      return;
    }

    if (!selectedCatalogId) {
      setCatalogPreviewItems([]);
      setCatalogPreviewError("");
      return;
    }

    void refreshCatalogPreview(selectedCatalogId);
  }, [activeSection, selectedCatalogId, sessionUser]);

  useEffect(() => {
    setIsCatalogWhatsappComposerOpen(false);
    setCatalogWhatsappMessage("");
    setCatalogWhatsappAttachment(null);
  }, [selectedCatalogId]);

  useEffect(() => {
    setSelectedCatalogClientIds((current) => current.filter((clientId) => storeOptions.some((store) => store.value === clientId)));
  }, [storeOptions]);

  useEffect(() => {
    setRouteForm((current) => {
      if (salesRepOptions.length === 0) {
        return current.salesRepId ? { ...current, salesRepId: "" } : current;
      }

      const hasCurrentSalesRep = salesRepOptions.some((option) => option.value === current.salesRepId);

      if (hasCurrentSalesRep) {
        return current;
      }

      return {
        ...current,
        salesRepId: salesRepOptions[0]?.value ?? "",
      };
    });
  }, [salesRepOptions]);

  useEffect(() => {
    if (sessionUser?.role !== "management" || (activeSection !== "inventory" && activeSection !== "catalog" && activeSection !== "dashboard")) {
      return;
    }

    void refreshInventorySummary();
  }, [activeSection, sessionUser]);

  useEffect(() => {
    if (sessionUser?.role !== "management" || (activeSection !== "orders" && activeSection !== "dashboard")) {
      return;
    }

    void refreshWarehouseOrders();
  }, [activeSection, sessionUser]);

  useEffect(() => {
    const PAGE_SIZE = 25;
    const tableWraps = Array.from(document.querySelectorAll<HTMLElement>(".table-wrap"));

    tableWraps.forEach((wrap, index) => {
      const tbody = wrap.querySelector("table.data-table tbody");

      if (!tbody) {
        return;
      }

      const rows = Array.from(tbody.querySelectorAll(":scope > tr")) as HTMLTableRowElement[];
      const tableKey = String(index);
      const controlsSelector = `.table-pagination-controls[data-table-key="${tableKey}"]`;
      const existingControls = wrap.parentElement?.querySelector(controlsSelector);

      if (rows.length <= PAGE_SIZE) {
        rows.forEach((row) => {
          row.style.display = "";
        });

        if (existingControls) {
          existingControls.remove();
        }

        tablePaginationStateRef.current[tableKey] = 1;
        return;
      }

      const totalPages = Math.ceil(rows.length / PAGE_SIZE);
      const currentPage = Math.min(
        Math.max(tablePaginationStateRef.current[tableKey] ?? 1, 1),
        totalPages,
      );
      tablePaginationStateRef.current[tableKey] = currentPage;

      rows.forEach((row, rowIndex) => {
        const rowPage = Math.floor(rowIndex / PAGE_SIZE) + 1;
        row.style.display = rowPage === currentPage ? "" : "none";
      });

      if (existingControls) {
        existingControls.remove();
      }

      const controls = document.createElement("div");
      controls.className = "table-pagination-controls";
      controls.setAttribute("data-table-key", tableKey);

      for (let page = 1; page <= totalPages; page += 1) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `table-pagination-button ${page === currentPage ? "is-active" : ""}`;
        button.textContent = String(page);
        button.onclick = () => {
          tablePaginationStateRef.current[tableKey] = page;

          rows.forEach((row, rowIndex) => {
            const rowPage = Math.floor(rowIndex / PAGE_SIZE) + 1;
            row.style.display = rowPage === page ? "" : "none";
          });

          const siblingButtons = controls.querySelectorAll<HTMLButtonElement>(".table-pagination-button");
          siblingButtons.forEach((item) => {
            if (item.textContent === String(page)) {
              item.classList.add("is-active");
            } else {
              item.classList.remove("is-active");
            }
          });
        };

        controls.appendChild(button);
      }

      wrap.insertAdjacentElement("afterend", controls);
    });
  });

  useEffect(() => {
    if (sessionUser?.role !== "warehouse-aruba") {
      setWarehouseActiveSection("inventory");
      setWarehouseOrders([]);
      setWarehouseOrdersError("");
      return;
    }

    if (warehouseActiveSection === "inventory") {
      void refreshInventorySummary();
      return;
    }

    void refreshWarehouseOrders();
  }, [sessionUser, warehouseActiveSection]);

  useEffect(() => {
    if (sessionUser?.role !== "warehouse-aruba" || !selectedWarehouseOrderDetail) {
      setWarehouseOrderChecklist({});
      setWarehouseOrderCompletionStatus(null);
      return;
    }

    setWarehouseOrderChecklist(
      Object.fromEntries(
        selectedWarehouseOrderDetail.items.map((item) => [item.productId, selectedWarehouseOrderDetail.status === "delivered"]),
      ),
    );
    setWarehouseOrderCompletionStatus(null);
  }, [selectedWarehouseOrderDetail, sessionUser]);

  useEffect(() => {
    if (sessionUser?.role !== "warehouse-aruba" || warehouseActiveSection !== "orders" || !selectedWarehouseOrderDetail) {
      return;
    }

    if (!selectedCatalogId) {
      setCatalogPreviewItems([]);
      setCatalogPreviewError("");
      return;
    }

    void refreshCatalogPreview(selectedCatalogId, selectedWarehouseOrderDetail.storeId);
  }, [selectedCatalogId, selectedWarehouseOrderDetail, sessionUser, warehouseActiveSection]);

  useEffect(() => {
    if (sessionUser?.role !== "sales-rep-aruba") {
      setSellerActiveSection("routes");
      setSellerRoutes([]);
      setSellerOrders([]);
      setSellerOrdersError("");
      setSelectedSellerRouteId("");
      return;
    }

    void Promise.all([refreshSellerRoutes(sessionUser.id), refreshSellerOrders(sessionUser.id)]);
  }, [sessionUser]);

  useEffect(() => {
    if (sellerRoutes.length === 0) {
      setSelectedSellerRouteId("");
      return;
    }

    setSelectedSellerRouteId((current) => (
      sellerRoutes.some((route) => (route._id ?? route.code) === current)
        ? current
        : (sellerRoutes[0]?._id ?? sellerRoutes[0]?.code ?? "")
    ));
  }, [sellerRoutes]);

  useEffect(() => {
    if (!selectedSellerRoute) {
      setSelectedSellerDayKey("");
      return;
    }

    setSelectedSellerDayKey((current) => (
      selectedSellerRoute.days.some((day) => day.day === current)
        ? current
        : (selectedSellerRoute.days[0]?.day ?? "")
    ));
  }, [selectedSellerRoute]);

  useEffect(() => {
    if (selectedSellerStores.length === 0) {
      setSelectedSellerStoreId("");
      return;
    }

    setSelectedSellerStoreId((current) => (
      selectedSellerStores.some((store) => store.storeId === current)
        ? current
        : selectedSellerStores[0]?.storeId ?? ""
    ));
  }, [selectedSellerStores]);

  useEffect(() => {
    if (sessionUser?.role !== "sales-rep-aruba" || !selectedSellerStoreId) {
      setSellerAssignedStore(null);
      setSellerClientProducts([]);
      setSellerClientProductsError("");
      setSellerOrderDraft({});
      return;
    }

    void refreshSellerClientProducts(selectedSellerStoreId);
  }, [selectedSellerStoreId, sessionUser]);

  async function refreshKpis() {
    const response = await fetch(`${apiBaseUrl}/management/kpis`);
    const data = (await response.json()) as { cards: KpiCard[] };
    setKpis(data.cards);
  }

  async function refreshSellerRoutes(salesRepId: string) {
    try {
      setIsLoadingSellerRoutes(true);
      setSellerRoutesError("");
      const response = await fetch(`${apiBaseUrl}/sales/routes?salesRepId=${encodeURIComponent(salesRepId)}`);
      const data = (await response.json()) as SalesRouteRecord[] | { message?: string };

      if (!response.ok || !Array.isArray(data)) {
        setSellerRoutesError(Array.isArray(data) ? "No fue posible cargar tus rutas asignadas." : data.message ?? "No fue posible cargar tus rutas asignadas.");
        return;
      }

      setSellerRoutes(data);
    } catch {
      setSellerRoutesError("No fue posible conectar con el backend.");
    } finally {
      setIsLoadingSellerRoutes(false);
    }
  }

  async function refreshSellerOrders(salesRepId: string) {
    try {
      setIsLoadingSellerOrders(true);
      setSellerOrdersError("");
      const response = await fetch(`${apiBaseUrl}/sales/orders?salesRepId=${encodeURIComponent(salesRepId)}`);
      const data = (await response.json()) as SellerOrderRecord[] | { message?: string };

      if (!response.ok || !Array.isArray(data)) {
        setSellerOrdersError(Array.isArray(data) ? "No fue posible cargar tus pedidos." : data.message ?? "No fue posible cargar tus pedidos.");
        return;
      }

      setSellerOrders(
        data.map((order) => ({
          ...order,
          items: Array.isArray(order.items) ? order.items : [],
        })),
      );
    } catch {
      setSellerOrdersError("No fue posible conectar con el backend.");
    } finally {
      setIsLoadingSellerOrders(false);
    }
  }

  async function refreshWarehouseOrders() {
    try {
      setIsLoadingWarehouseOrders(true);
      setWarehouseOrdersError("");
      const response = await fetch(`${apiBaseUrl}/warehouse/orders`);
      const data = (await response.json()) as SellerOrderRecord[] | { message?: string };

      if (!response.ok || !Array.isArray(data)) {
        setWarehouseOrdersError(Array.isArray(data) ? "No fue posible cargar los pedidos de bodega." : data.message ?? "No fue posible cargar los pedidos de bodega.");
        return;
      }

      setWarehouseOrders(data.map((order) => ({ ...order, items: Array.isArray(order.items) ? order.items : [] })));
    } catch {
      setWarehouseOrdersError("No fue posible conectar con el backend.");
    } finally {
      setIsLoadingWarehouseOrders(false);
    }
  }

  async function refreshSellerClientProducts(storeId: string) {
    try {
      setIsLoadingSellerClientProducts(true);
      setSellerClientProductsError("");
      setSellerOrderStatus(null);
      const response = await fetch(`${apiBaseUrl}/sales/stores/${storeId}/products`);
      const data = (await response.json()) as SellerAssignedStoreResponse | { message?: string };

      if (!response.ok || !("products" in data) || !Array.isArray(data.products)) {
        setSellerAssignedStore(null);
        setSellerClientProducts([]);
        setSellerClientProductsError("message" in data ? data.message ?? "No fue posible cargar los productos del cliente." : "No fue posible cargar los productos del cliente.");
        return;
      }

      setSellerAssignedStore(data.store);
      setSellerClientProducts(data.products.map((product) => ({
        ...product,
        imageUrl: typeof product.imageUrl === "string" ? product.imageUrl : "",
        salePrice: Number(product.salePrice ?? 0),
      })));
      setSellerOrderDraft({});
    } catch {
      setSellerAssignedStore(null);
      setSellerClientProducts([]);
      setSellerClientProductsError("No fue posible conectar con el backend.");
    } finally {
      setIsLoadingSellerClientProducts(false);
    }
  }

  async function refreshReferenceOptions() {
    try {
      const [categoryResponse, supplierResponse, usersResponse, clientsResponse, warehousesResponse, productsResponse] = await Promise.all([
        fetch(`${apiBaseUrl}/management/categories`),
        fetch(`${apiBaseUrl}/management/suppliers`),
        fetch(`${apiBaseUrl}/management/users`),
        fetch(`${apiBaseUrl}/management/clients`),
        fetch(`${apiBaseUrl}/management/warehouses`),
        fetch(`${apiBaseUrl}/management/products`),
      ]);
      const categoryData = (await categoryResponse.json()) as Array<Record<string, unknown>>;
      const supplierData = (await supplierResponse.json()) as Array<Record<string, unknown>>;
      const usersData = (await usersResponse.json()) as Array<Record<string, unknown>>;
      const clientsData = (await clientsResponse.json()) as Array<Record<string, unknown>>;
      const warehousesData = (await warehousesResponse.json()) as Array<Record<string, unknown>>;
      const productsData = (await productsResponse.json()) as Array<Record<string, unknown>>;

      if (categoryResponse.ok && Array.isArray(categoryData)) {
        setCategoryOptions(
          categoryData
            .map((category) => ({ value: String(category.name ?? ""), label: String(category.name ?? "") }))
            .filter((category) => category.value.length > 0),
        );
      }

      if (supplierResponse.ok && Array.isArray(supplierData)) {
        setSupplierOptions(
          supplierData
            .map((supplier) => ({ value: String(supplier.name ?? ""), label: String(supplier.name ?? "") }))
            .filter((supplier) => supplier.value.length > 0),
        );
      }

      if (usersResponse.ok && Array.isArray(usersData)) {
        const nextSalesReps = usersData
          .filter((user) => user.role === "sales-rep-aruba" && user.active !== false)
          .map((user) => ({
            value: String(user._id ?? ""),
            label: String(user.name ?? user.email ?? "Vendedor sin nombre"),
          }))
          .filter((user) => user.value.length > 0);

        setSalesRepOptions(nextSalesReps);
        setRouteForm((current) => ({
          ...current,
          salesRepId: current.salesRepId || nextSalesReps[0]?.value || "",
        }));
      }

      if (clientsResponse.ok && Array.isArray(clientsData)) {
        setStoreOptions(
          clientsData
            .map((client) => ({
              value: String(client._id ?? ""),
              label: String(client.name ?? ""),
              address: String(client.address ?? ""),
              code: String(client.code ?? ""),
              email: String(client.email ?? ""),
              phone: String(client.phone ?? ""),
              managerName: String(client.managerName ?? ""),
              assignedProductIds: Array.isArray(client.assignedProductIds)
                ? client.assignedProductIds.map((entry) => String(entry)).filter(Boolean)
                : [],
            }))
            .filter((client) => client.value.length > 0 && client.label.length > 0),
        );
      }

      if (warehousesResponse.ok && Array.isArray(warehousesData)) {
        const nextWarehouseOptions = warehousesData
          .filter((warehouse) => warehouse.active !== false)
          .map((warehouse) => ({
            value: String(warehouse._id ?? ""),
            label: String(warehouse.name ?? ""),
            code: String(warehouse.code ?? ""),
            address: String(warehouse.address ?? ""),
          }))
          .filter((warehouse) => warehouse.value.length > 0 && warehouse.label.length > 0);

        setWarehouseOptions(nextWarehouseOptions);
        setSelectedWarehouseId((current) => current || nextWarehouseOptions[0]?.value || "");
      }

      if (productsResponse.ok && Array.isArray(productsData)) {
        const nextProductOptions = productsData
          .filter((product) => product.active !== false)
          .map((product) => ({
            value: String(product._id ?? ""),
            label: String(product.name ?? ""),
            sku: String(product.sku ?? ""),
            salePrice: roundCurrencyValue(Number(product.salePrice ?? 0)),
            productWeightKg: Number(product.productWeightKg ?? 0),
            variableSalePrice: Boolean(product.variableSalePrice),
            unitsPerBox: Number(product.unitsPerBox ?? 0),
            unitsPerBoxUnit: String(product.unitsPerBoxUnit ?? "unidad"),
            boxLengthCm: Number(product.boxLengthCm ?? 0),
            boxWidthCm: Number(product.boxWidthCm ?? 0),
            boxHeightCm: Number(product.boxHeightCm ?? 0),
          }))
          .filter((product) => product.value.length > 0 && product.label.length > 0);

        setProductOptions(nextProductOptions);
        setWarehouseLocationForm((current) => ({
          ...current,
          productId: current.productId || nextProductOptions[0]?.value || "",
        }));
      }
    } catch {
      setCategoryOptions([]);
      setSupplierOptions([]);
      setSalesRepOptions([]);
      setStoreOptions([]);
      setWarehouseOptions([]);
      setProductOptions([]);
    }
  }

  async function refreshCreationRows(config: CollectionConfig, options?: { silent?: boolean }) {
    try {
      if (!options?.silent) {
        setIsLoadingCreationRows(true);
      }
      setCreationRowsError("");
      const response = await fetch(`${apiBaseUrl}${config.endpoint}`);
      const data = (await response.json()) as Array<Record<string, unknown>> | { message?: string };

      if (!response.ok || !Array.isArray(data)) {
        setCreationRowsError(Array.isArray(data) ? "No fue posible cargar los registros." : data.message ?? "No fue posible cargar los registros.");
        return null;
      }

      setDatabaseRows((current) => ({
        ...current,
        [config.key]: data,
      }));

      return data;
    } catch {
      setCreationRowsError("No fue posible conectar con el backend.");
      return null;
    } finally {
      if (!options?.silent) {
        setIsLoadingCreationRows(false);
      }
    }
  }

  async function refreshRoutesDatabase() {
    const response = await fetch(`${apiBaseUrl}/management/routes`);
    const data = (await response.json()) as SalesRouteRecord[];
    if (Array.isArray(data)) {
      setRoutes(data);
    }
  }

  async function refreshWarehouseLocations(warehouseId: string) {
    if (!warehouseId) {
      setWarehouseLocations([]);
      return;
    }

    const response = await fetch(
      `${apiBaseUrl}/management/warehouse-locations?warehouseId=${encodeURIComponent(warehouseId)}`,
    );
    const data = (await response.json()) as WarehouseLocationRecord[];

    if (Array.isArray(data)) {
      setWarehouseLocations(data);
    }
  }

  async function refreshAccountingData() {
    try {
      setIsLoadingAccounting(true);
      setAccountingError("");
      const [importResponse, fixedResponse, operationalResponse] = await Promise.all([
        fetch(`${apiBaseUrl}/management/accounting/import-costs`),
        fetch(`${apiBaseUrl}/management/accounting/fixed-costs`),
        fetch(`${apiBaseUrl}/management/accounting/operational-expenses`),
      ]);
      const importData = (await importResponse.json()) as ImportCostRecord[] | { message?: string };
      const fixedData = (await fixedResponse.json()) as FixedCostRecord[] | { message?: string };
      const operationalData = (await operationalResponse.json()) as OperationalExpenseRecord[] | { message?: string };

      if (!importResponse.ok || !Array.isArray(importData) || !fixedResponse.ok || !Array.isArray(fixedData) || !operationalResponse.ok || !Array.isArray(operationalData)) {
        setAccountingError("No fue posible cargar la informacion contable.");
        return;
      }

      setImportCostRows(importData);
      setFixedCostRows(fixedData);
      setOperationalExpenseRows(operationalData);
    } catch {
      setAccountingError("No fue posible conectar con el backend.");
    } finally {
      setIsLoadingAccounting(false);
    }
  }

  async function refreshLogisticsAccountingData() {
    try {
      setIsLoadingLogisticsAccounting(true);
      setLogisticsAccountingError("");
      const [invoicesRes, billedOrdersRes, fixedRes, expensesRes] = await Promise.all([
        fetch(`${apiBaseUrl}/management/logistics-accounting/invoices`),
        fetch(`${apiBaseUrl}/management/logistics-accounting/billed-orders`),
        fetch(`${apiBaseUrl}/management/logistics-accounting/fixed-costs`),
        fetch(`${apiBaseUrl}/management/logistics-accounting/expenses`),
      ]);
      const invoicesData = (await invoicesRes.json()) as LogisticsInvoiceRecord[] | { message?: string };
      const billedOrdersPayload = billedOrdersRes.ok
        ? ((await billedOrdersRes.json()) as LogisticsBilledOrderRecord[] | { message?: string })
        : [];
      const fixedData = (await fixedRes.json()) as LogisticsFixedCostRecord[] | { message?: string };
      const expensesData = (await expensesRes.json()) as LogisticsExpenseRecord[] | { message?: string };

      if (
        !invoicesRes.ok || !Array.isArray(invoicesData)
        || !fixedRes.ok || !Array.isArray(fixedData)
        || !expensesRes.ok || !Array.isArray(expensesData)
      ) {
        setLogisticsAccountingError("No fue posible cargar la informacion contable logistica.");
        return;
      }

      const billedOrdersData = Array.isArray(billedOrdersPayload)
        ? billedOrdersPayload
        : invoicesData
            .filter((invoice) => typeof invoice.orderId === "string" && invoice.orderId.trim().length > 0)
            .map((invoice) => ({
              _id: invoice._id,
              orderId: String(invoice.orderId ?? ""),
              invoiceDate: invoice.invoiceDate,
              storeName: invoice.storeName,
              salesRepName: invoice.salesRepName,
              routeName: invoice.routeName,
              totalCostAwg: Number(invoice.totalCostAwg ?? 0),
              totalRevenueAwg: Number(invoice.totalRevenueAwg ?? 0),
              totalUtilityAwg: Number(invoice.totalUtilityAwg ?? 0),
            }));

      setLogisticsInvoices(invoicesData);
      setLogisticsBilledOrders(billedOrdersData);
      setLogisticsFixedCosts(fixedData);
      setLogisticsExpenses(expensesData);
    } catch {
      setLogisticsAccountingError("No fue posible conectar con el backend.");
    } finally {
      setIsLoadingLogisticsAccounting(false);
    }
  }

  async function refreshInventorySummary() {
    try {
      setIsLoadingInventory(true);
      setInventoryError("");
      const arubaInventoryRoles = new Set(["warehouse-aruba", "sales-rep-aruba", "management"]);
      const businessUnit = arubaInventoryRoles.has(String(sessionUser?.role ?? "")) ? "aruba" : "colombia";
      const response = await fetch(`${apiBaseUrl}/management/inventory-summary?businessUnit=${businessUnit}`);
      const data = (await response.json()) as InventorySummaryResponse | { message?: string };

      if (!response.ok || !("rows" in data) || !Array.isArray(data.rows)) {
        setInventoryError("message" in data ? data.message ?? "No fue posible cargar el inventario." : "No fue posible cargar el inventario.");
        return;
      }

      setInventoryRows(data.rows);
      setInventoryKpis(data.kpis);
      setInventoryHistoryRows(Array.isArray(data.history) ? data.history : []);
    } catch {
      setInventoryError("No fue posible conectar con el backend.");
    } finally {
      setIsLoadingInventory(false);
    }
  }

  function toggleExpiringSoonInventoryFilter() {
    setInventoryFilter((current) => (current === "expiring-soon" ? "all" : "expiring-soon"));
  }

  function openInventoryAdjustmentModal(row: InventorySummaryRow) {
    setSelectedInventoryAdjustmentRow(row);
    setInventoryAdjustmentStatus(null);
    setInventoryAdjustmentForm(createInitialInventoryAdjustmentForm());
  }

  function openInventoryEntryModal() {
    if (warehouseOptions.length === 0) {
      setInventoryError("Primero crea una bodega para registrar entradas de inventario.");
      return;
    }

    setInventoryEntryStatus(null);
    setInventoryEntryWarehouseId(selectedWarehouseId || warehouseOptions[0]?.value || "");
    setInventoryUsdToAwgRate("1.79");
    setInventoryEntryItems([createInventoryEntryDraftItem()]);
    setIsInventoryEntryModalOpen(true);
  }

  function openInventoryEntryPage() {
    if (warehouseOptions.length === 0) {
      setInventoryError("Primero crea una bodega para registrar entradas de inventario.");
      return;
    }

    setInventoryEntryStatus(null);
    setInventoryEntryWarehouseId(selectedWarehouseId || warehouseOptions[0]?.value || "");
    setInventoryUsdToAwgRate("1.79");
    setInventoryEntryItems([createInventoryEntryDraftItem()]);
    setInventoryExcelFileName("");
    setActiveSection("inventory-entry");
  }

  function closeInventoryEntryModal() {
    setIsInventoryEntryModalOpen(false);
    setInventoryEntryStatus(null);
  }

  function addInventoryEntryRow() {
    setInventoryEntryItems((current) => [...current, createInventoryEntryDraftItem()]);
  }

  function removeInventoryEntryRow(id: string) {
    setInventoryEntryItems((current) => (
      current.length <= 1
        ? current
        : current.filter((item) => item.id !== id)
    ));
  }

  function updateInventoryEntryRow(
    id: string,
    field: "productId" | "quantity" | "costUsd" | "salePriceAwg" | "expirationDate" | "productWeightKg",
    value: string,
  ) {
    setInventoryEntryItems((current) => current.map((item) => {
      if (item.id !== id) {
        return item;
      }

      if (field === "productId") {
        const selectedProduct = productOptions.find((product) => product.value === value);

        return {
          ...item,
          productId: value,
          salePriceAwg: item.salePriceAwg || String(selectedProduct?.salePrice ?? ""),
          productWeightKg: item.productWeightKg || String(selectedProduct?.productWeightKg ?? ""),
        };
      }

      return { ...item, [field]: value };
    }));
  }

  function loadInventoryEntryHistoryGroupForEdit(groupId: string) {
    const selectedGroup = inventoryEntryHistoryGroups.find((group) => group.id === groupId);

    if (!selectedGroup) {
      return;
    }

    const warehouseId = String(selectedGroup.warehouseId ?? "").trim()
      || warehouseOptions.find((warehouse) => (
        String(warehouse.label || "").trim().toLowerCase() === String(selectedGroup.warehouseName || "").trim().toLowerCase()
      ))?.value
      || selectedWarehouseId
      || warehouseOptions[0]?.value
      || "";
    const usdToAwgRate = Number(selectedGroup.usdToAwgRate ?? 0);
    const hasAllRowsEditableData = selectedGroup.items.every((item) => Number.isFinite(Number(item.entryCostUsd ?? 0)));

    if (!warehouseId || !(usdToAwgRate > 0) || !hasAllRowsEditableData) {
      setInventoryEntryStatus({ tone: "error", message: "Esta entrada no tiene todos los datos necesarios para cargarla en modo edicion." });
      return;
    }

    setInventoryEntryWarehouseId(warehouseId);
    setInventoryUsdToAwgRate(String(usdToAwgRate));
    setInventoryEntryItems(selectedGroup.items.map((item) => ({
      id: createInventoryEntryDraftItem(item.productId).id,
      productId: item.productId,
      quantity: String(item.quantity),
      costUsd: String(Number(item.entryCostUsd ?? 0)),
      salePriceAwg: String(productOptions.find((option) => option.value === item.productId)?.salePrice ?? ""),
      expirationDate: "",
      productWeightKg: String(productOptions.find((option) => option.value === item.productId)?.productWeightKg ?? ""),
    })));
    setInventoryEntryStatus({
      tone: "success",
      message: `Entrada cargada para editar (${selectedGroup.productCount} producto${selectedGroup.productCount === 1 ? "" : "s"}).`,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openInventoryEntryHistoryGroupDetails(groupId: string) {
    setSelectedInventoryEntryHistoryGroupId(groupId);
  }

  function closeInventoryEntryHistoryGroupDetails() {
    setSelectedInventoryEntryHistoryGroupId("");
  }

  function getInventoryEntryCostAwg(costUsdValue: string) {
    const usdCost = Number(costUsdValue || 0);
    const usdToAwgRate = Number(inventoryUsdToAwgRate || 0);

    if (!Number.isFinite(usdCost) || !Number.isFinite(usdToAwgRate)) {
      return "";
    }

    return String(roundCurrencyValue(usdCost * usdToAwgRate));
  }

  function openInventoryEntryItemModal() {
    const initialProductId = productOptions[0]?.value ?? "";
    const initialProduct = productOptions.find((product) => product.value === initialProductId);

    setInventoryEntryItemDraft({
      productId: initialProductId,
      quantity: "",
      costUsd: "",
      salePriceAwg: String(initialProduct?.salePrice ?? ""),
      expirationDate: "",
      productWeightKg: String(initialProduct?.productWeightKg ?? ""),
    });
    setIsInventoryEntryItemModalOpen(true);
  }

  function closeInventoryEntryItemModal() {
    setIsInventoryEntryItemModalOpen(false);
  }

  function submitInventoryEntryItemModal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const productId = inventoryEntryItemDraft.productId.trim();
    const quantity = Number(inventoryEntryItemDraft.quantity || 0);
    const costUsd = Number(inventoryEntryItemDraft.costUsd || 0);
    const salePriceAwg = Number(inventoryEntryItemDraft.salePriceAwg || 0);
    const productWeightKg = Number(inventoryEntryItemDraft.productWeightKg || 0);
    const expirationDate = inventoryEntryItemDraft.expirationDate.trim();

    if (!productId) {
      setInventoryEntryStatus({ tone: "error", message: "Selecciona un producto para agregarlo a la tabla." });
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setInventoryEntryStatus({ tone: "error", message: "La cantidad debe ser mayor a cero." });
      return;
    }

    if (!Number.isFinite(costUsd) || costUsd < 0) {
      setInventoryEntryStatus({ tone: "error", message: "El costo USD debe ser cero o mayor." });
      return;
    }

    if (!Number.isFinite(salePriceAwg) || salePriceAwg < 0) {
      setInventoryEntryStatus({ tone: "error", message: "La venta AWG debe ser cero o mayor." });
      return;
    }

    if (!Number.isFinite(productWeightKg) || productWeightKg < 0) {
      setInventoryEntryStatus({ tone: "error", message: "El peso por unidad debe ser cero o mayor." });
      return;
    }

    if (expirationDate) {
      const date = new Date(expirationDate);

      if (Number.isNaN(date.getTime())) {
        setInventoryEntryStatus({ tone: "error", message: "La fecha de caducidad no es valida." });
        return;
      }
    }

    setInventoryEntryItems((current) => {
      if (current.some((item) => item.productId === productId)) {
        return current.map((item) => (
          item.productId === productId
            ? {
                ...item,
                quantity: String(quantity),
                costUsd: String(costUsd),
                salePriceAwg: String(salePriceAwg),
                expirationDate,
                productWeightKg: String(productWeightKg),
              }
            : item
        ));
      }

      return [...current, {
        id: createInventoryEntryDraftItem(productId).id,
        productId,
        quantity: String(quantity),
        costUsd: String(costUsd),
        salePriceAwg: String(salePriceAwg),
        expirationDate,
        productWeightKg: String(productWeightKg),
      }];
    });

    setInventoryEntryStatus(null);
    closeInventoryEntryItemModal();
  }

  async function persistBillingInvoicePricing() {
    if (selectedBillingRows.length === 0 || !selectedBillingBatch?.containerReference) {
      return false;
    }

    if (!Number.isFinite(billingTrmValue) || billingTrmValue <= 0) {
      setAccountingError("Antes de generar la factura define una TRM valida (COP por 1 USD).");
      return false;
    }

    try {
      setAccountingError("");
      const rows: Array<{ productId: string; saleUsd: number }> = [];

      for (let index = 0; index < selectedBillingRows.length; index += 1) {
        const row = selectedBillingRows[index];
        const saleUsd = parseDecimalInput(getEffectiveBillingSaleUsd(row, index));

        if (!Number.isFinite(saleUsd) || saleUsd < 0) {
          setAccountingError(`El precio USD del producto ${row.productName} no es valido.`);
          return false;
        }

        rows.push({
          productId: row.productId,
          saleUsd,
        });
      }

      const response = await fetch(
        `${apiBaseUrl}/management/accounting/import-batches/${encodeURIComponent(selectedBillingBatch.containerReference)}/invoice-pricing`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trmCopPerUsd: billingTrmValue, rows }),
        },
      );
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setAccountingError(data.message ?? "No fue posible guardar los precios facturados de la exportacion.");
        return false;
      }

      await refreshAccountingData();
      setHasPendingBillingPricingChanges(false);
      setEditingBillingReference("");
      return true;
    } catch {
      setAccountingError("No fue posible conectar con el backend para guardar la factura.");
      return false;
    }
  }

  async function downloadBillingInvoicePdf() {
    if (selectedBillingRows.length === 0) {
      return;
    }

    const persisted = await persistBillingInvoicePricing();

    if (!persisted) {
      return;
    }

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const reference = selectedBillingBatch?.containerReference || "EXPORTACION";
    const shipment = selectedBillingBatch?.shipmentReference || "SIN ENVIO";

    doc.setFontSize(14);
    doc.text(`Factura exportacion ${reference}`, 40, 36);
    doc.setFontSize(10);
    doc.text(`Envio: ${shipment}`, 40, 52);

    const lineRows = selectedBillingRows.map((row, index) => {
      const quantity = Number(row.importedQuantity || 0);
      const saleUsd = parseDecimalInput(getEffectiveBillingSaleUsd(row, index));
      const lineTotalUsd = quantity * saleUsd;

      return {
        productName: row.productName,
        productSku: row.productSku,
        quantity,
        saleUsd,
        lineTotalUsd,
      };
    });
    const grandTotalUsd = lineRows.reduce((sum, row) => sum + row.lineTotalUsd, 0);
    const rows = lineRows.map((row) => [
      row.productName,
      row.productSku,
      String(row.quantity),
      formatUsdCurrency(row.saleUsd),
      formatUsdCurrency(row.lineTotalUsd),
    ]);
    rows.push(["TOTAL", "", "", "", formatUsdCurrency(grandTotalUsd)]);

    autoTable(doc, {
      startY: 68,
      head: [["Producto", "SKU", "Cantidad", "Venta USD/u", "Total USD"]],
      body: rows,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [26, 115, 232] },
    });

    doc.save(`factura-exportacion-${String(reference).toLowerCase()}.pdf`);
  }

  async function downloadBillingInvoiceExcel() {
    if (selectedBillingRows.length === 0) {
      return;
    }

    const persisted = await persistBillingInvoicePricing();

    if (!persisted) {
      return;
    }

    const rows = selectedBillingRows.map((row, index) => {
      const quantity = Number(row.importedQuantity || 0);
      const saleUsd = parseDecimalInput(getEffectiveBillingSaleUsd(row, index));
      const totalUsd = quantity * saleUsd;

      return {
      PRODUCT_ID: row.productId,
      SKU: row.productSku,
      PRODUCTO: row.productName,
      CANTIDAD: quantity,
      PRECIO_VENTA_USD: saleUsd,
      TOTAL_USD: totalUsd,
      };
    });
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Factura");
    const reference = selectedBillingBatch?.containerReference || "exportacion";
    XLSX.writeFile(workbook, `factura-${String(reference).toLowerCase()}.xlsx`);
  }

  async function handleInventoryExcelUpload(file: File | null) {
    if (!file) {
      return;
    }

    try {
      setIsImportingInventoryExcel(true);
      setInventoryEntryStatus(null);

      const fileBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = typeof reader.result === "string" ? reader.result : "";
          const base64 = result.includes(",") ? result.split(",")[1] : "";

          if (!base64) {
            reject(new Error("No fue posible leer el archivo Excel."));
            return;
          }

          resolve(base64);
        };
        reader.onerror = () => reject(new Error("No fue posible leer el archivo Excel."));
        reader.readAsDataURL(file);
      });

      const response = await fetch(`${apiBaseUrl}/management/inventory-entries/import-excel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileBase64 }),
      });
      const data = (await response.json()) as {
        message?: string;
        items?: Array<{ productId: string; quantity: number; costUsd: number }>;
      };

      if (!response.ok || !Array.isArray(data.items)) {
        setInventoryEntryStatus({ tone: "error", message: data.message ?? "No se pudo importar el Excel." });
        return;
      }

      setInventoryEntryItems(
        data.items.map((item) => ({
          id: createInventoryEntryDraftItem(item.productId).id,
          productId: item.productId,
          quantity: String(item.quantity),
          costUsd: String(item.costUsd),
          salePriceAwg: "",
          expirationDate: "",
          productWeightKg: "",
        })),
      );
      setInventoryExcelFileName(file.name);
      setInventoryEntryStatus({
        tone: "success",
        message: data.message ?? `Excel importado con ${data.items.length} producto${data.items.length === 1 ? "" : "s"}.`,
      });
    } catch (error) {
      setInventoryEntryStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "No se pudo importar el Excel.",
      });
    } finally {
      setIsImportingInventoryExcel(false);
    }
  }

  function closeInventoryAdjustmentModal() {
    setSelectedInventoryAdjustmentRow(null);
    setInventoryAdjustmentStatus(null);
    setInventoryAdjustmentForm(createInitialInventoryAdjustmentForm());
  }

  async function handleInventoryAdjustmentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedInventoryAdjustmentRow) {
      return;
    }

    const quantity = Number(inventoryAdjustmentForm.quantity || 0);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setInventoryAdjustmentStatus({ tone: "error", message: "Ingresa una cantidad valida para sacar del inventario." });
      return;
    }

    if (quantity > selectedInventoryAdjustmentRow.quantity) {
      setInventoryAdjustmentStatus({ tone: "error", message: "La cantidad supera el inventario disponible del producto." });
      return;
    }

    if (!inventoryAdjustmentForm.reason.trim()) {
      setInventoryAdjustmentStatus({ tone: "error", message: "Selecciona un motivo para la salida." });
      return;
    }

    try {
      setIsSavingInventoryAdjustment(true);
      setInventoryAdjustmentStatus(null);
      const response = await fetch(`${apiBaseUrl}/management/inventory-adjustments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedInventoryAdjustmentRow.productId,
          quantity,
          reason: inventoryAdjustmentForm.reason,
          notes: inventoryAdjustmentForm.notes,
        }),
      });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setInventoryAdjustmentStatus({ tone: "error", message: data.message ?? "No fue posible registrar la salida del inventario." });
        return;
      }

      await refreshInventorySummary();
      closeInventoryAdjustmentModal();
    } catch {
      setInventoryAdjustmentStatus({ tone: "error", message: "No fue posible conectar con el backend." });
    } finally {
      setIsSavingInventoryAdjustment(false);
    }
  }

  async function handleInventoryEntrySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!inventoryEntryWarehouseId) {
      setInventoryEntryStatus({ tone: "error", message: "Selecciona una bodega para registrar inventario." });
      return;
    }

    const usdToAwgRate = Number(inventoryUsdToAwgRate || 0);

    if (!Number.isFinite(usdToAwgRate) || usdToAwgRate <= 0) {
      setInventoryEntryStatus({ tone: "error", message: "Ingresa una tasa valida en USD@AWG mayor a cero." });
      return;
    }

    try {
      const normalizedItems = inventoryEntryItems.map((item, index) => {
        const productId = item.productId.trim();
        const quantity = Number(item.quantity || 0);
        const costUsd = Number(item.costUsd || 0);
        const salePriceAwg = Number(item.salePriceAwg || 0);
        const productWeightKg = Number(item.productWeightKg || 0);
        const expirationDate = item.expirationDate.trim();

        if (!productId) {
          throw new Error(`Selecciona el producto en la fila ${index + 1}.`);
        }

        if (!Number.isFinite(quantity) || quantity <= 0) {
          throw new Error(`La cantidad de la fila ${index + 1} debe ser mayor a cero.`);
        }

        if (!Number.isFinite(costUsd) || costUsd < 0) {
          throw new Error(`El costo en USD de la fila ${index + 1} debe ser cero o mayor.`);
        }

        if (!Number.isFinite(salePriceAwg) || salePriceAwg < 0) {
          throw new Error(`La venta AWG de la fila ${index + 1} debe ser cero o mayor.`);
        }

        if (!Number.isFinite(productWeightKg) || productWeightKg < 0) {
          throw new Error(`El peso por unidad de la fila ${index + 1} debe ser cero o mayor.`);
        }

        if (expirationDate) {
          const date = new Date(expirationDate);

          if (Number.isNaN(date.getTime())) {
            throw new Error(`La caducidad de la fila ${index + 1} no es valida.`);
          }
        }

        return { productId, quantity, costUsd, salePriceAwg, expirationDate, productWeightKg };
      });

      if (new Set(normalizedItems.map((item) => item.productId)).size !== normalizedItems.length) {
        setInventoryEntryStatus({ tone: "error", message: "No repitas productos en el mismo registro de inventario." });
        return;
      }

      setIsSavingInventoryEntry(true);
      setInventoryEntryStatus(null);
      const response = await fetch(`${apiBaseUrl}/management/inventory-entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouseId: inventoryEntryWarehouseId,
          usdToAwgRate,
          items: normalizedItems,
        }),
      });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setInventoryEntryStatus({ tone: "error", message: data.message ?? "No fue posible registrar el inventario." });
        return;
      }

      await refreshInventorySummary();
      setInventoryEntryStatus({ tone: "success", message: data.message ?? "Inventario registrado correctamente." });
      setIsInventoryEntryModalOpen(false);
    } catch (error) {
      setInventoryEntryStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "No fue posible registrar el inventario.",
      });
    } finally {
      setIsSavingInventoryEntry(false);
    }
  }

  async function refreshCatalogs() {
    try {
      setIsLoadingCatalogs(true);
      setCatalogError("");
      const response = await fetch(`${apiBaseUrl}/management/catalogs`);
      const data = (await response.json()) as CatalogRecord[] | { message?: string };

      if (!response.ok || !Array.isArray(data)) {
        setCatalogError(Array.isArray(data) ? "No fue posible cargar los catalogos." : data.message ?? "No fue posible cargar los catalogos.");
        return;
      }

      setCatalogs(data);
      setSelectedCatalogId((current) => {
        if (current && data.some((catalog) => catalog._id === current)) {
          return current;
        }

        return data[0]?._id ?? "";
      });
    } catch {
      setCatalogError("No fue posible conectar con el backend.");
    } finally {
      setIsLoadingCatalogs(false);
    }
  }

  async function refreshCatalogPreview(catalogId: string, clientId?: string) {
    try {
      setIsLoadingCatalogPreview(true);
      setCatalogPreviewError("");
      const query = clientId ? `?clientId=${encodeURIComponent(clientId)}` : "";
      const response = await fetch(`${apiBaseUrl}/management/catalogs/${catalogId}/preview${query}`);
      const data = (await response.json()) as CatalogPreviewResponse | { message?: string };

      if (!response.ok || !("items" in data) || !Array.isArray(data.items)) {
        setCatalogPreviewError("message" in data ? data.message ?? "No fue posible cargar el detalle del catalogo." : "No fue posible cargar el detalle del catalogo.");
        return;
      }

      setCatalogPreviewItems(
        data.items.map((item) => ({
          ...item,
          imageUrl: typeof item.imageUrl === "string" ? item.imageUrl : "",
          cost: roundCurrencyValue(Number(item.cost ?? 0)),
          salePrice: roundCurrencyValue(Number(item.salePrice ?? 0)),
        })),
      );
      setCatalogPricingMarkup(
        data.clientPricing && Number(data.clientPricing.markupPercent ?? 0) > 0
          ? String(data.clientPricing.markupPercent)
          : "",
      );
    } catch {
      setCatalogPreviewError("No fue posible conectar con el backend.");
    } finally {
      setIsLoadingCatalogPreview(false);
    }
  }

  async function buildWarehouseInvoicePdfDocument(order: SellerOrderRecord) {
    if (!selectedCatalogRecord) {
      throw new Error("Selecciona un catalogo antes de generar la factura.");
    }

    if (warehousePricedItems.length === 0) {
      throw new Error("Este pedido no tiene productos para facturar.");
    }

    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    const generatedAt = new Date();
    const generatedAtLabel = generatedAt.toLocaleDateString("es-CO", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const logoImage = await loadImageForPdf("/company-logo.jpeg");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 14;
    const lineHeight = 7;

    const drawHeader = () => {
      pdf.setFillColor(8, 15, 28);
      pdf.rect(0, 0, pageWidth, 34, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(20);
      pdf.text("Factura comercial", margin, 16);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9.5);
      pdf.text(`Generada el ${generatedAtLabel}`, margin, 23);
      pdf.text(`Catalogo: ${selectedCatalogRecord.name}`, margin, 28);

      if (logoImage) {
        pdf.setFillColor(255, 255, 255);
        pdf.roundedRect(pageWidth - 46, 6, 32, 22, 4, 4, "F");
        pdf.addImage(logoImage.dataUrl, logoImage.format, pageWidth - 42, 8, 24, 18);
      }
    };

    const drawTableHeader = (startY: number) => {
      pdf.setFillColor(244, 247, 250);
      pdf.rect(margin, startY, pageWidth - margin * 2, 8, "F");
      pdf.setTextColor(17, 17, 17);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.5);
      pdf.text("SKU", margin + 2, startY + 5.3);
      pdf.text("Producto", margin + 26, startY + 5.3);
      pdf.text("Cant.", pageWidth - 86, startY + 5.3);
      pdf.text("Precio", pageWidth - 58, startY + 5.3);
      pdf.text("Total", pageWidth - 24, startY + 5.3, { align: "right" });
    };

    drawHeader();
    pdf.setTextColor(17, 17, 17);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text("Datos del pedido", margin, 46);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9.5);
    pdf.text(`Cliente: ${order.storeName}`, margin, 53);
    pdf.text(`Vendedor: ${order.salesRepName}`, margin, 59);
    pdf.text(`Ruta: ${order.routeName} · ${formatRouteDayLabel(order.routeDay as RouteDayKey)}`, margin, 65);
    pdf.text(`Estado: ${formatSellerOrderStatus(order.status)}`, margin, 71);
    pdf.text(`Factura basada en el catalogo ${selectedCatalogRecord.name}.`, margin, 77);

    let currentY = 86;
    drawTableHeader(currentY);
    currentY += 12;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.8);

    for (const item of warehousePricedItems) {
      if (currentY > pageHeight - 26) {
        pdf.addPage();
        drawHeader();
        currentY = 42;
        drawTableHeader(currentY);
        currentY += 12;
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.8);
      }

      const productNameLines = pdf.splitTextToSize(item.productName, 78);
      const rowHeight = Math.max(lineHeight, productNameLines.length * 4.6);

      pdf.text(item.productSku || "-", margin + 2, currentY);
      pdf.text(productNameLines, margin + 26, currentY);
      pdf.text(String(item.quantity), pageWidth - 82, currentY);
      pdf.text(formatCurrency(item.resolvedSalePrice), pageWidth - 58, currentY);
      pdf.text(formatCurrency(item.lineTotal), pageWidth - 24, currentY, { align: "right" });
      currentY += rowHeight + 2;
      pdf.setDrawColor(223, 229, 235);
      pdf.line(margin, currentY - 4, pageWidth - margin, currentY - 4);
    }

    const summaryY = Math.min(currentY + 8, pageHeight - 28);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text(`Total factura: ${formatCurrency(warehouseInvoiceTotal)}`, pageWidth - margin, summaryY, { align: "right" });
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    pdf.text("SPS Trading Enterprises", margin, pageHeight - 8);

    const fileName = sanitizePdfFileName(`factura-${order.storeName}-${selectedCatalogRecord.name}-${generatedAtLabel}`) || "factura-pedido";
    return { pdf, fileName };
  }

  async function handleWarehouseOrderComplete() {
    if (!selectedWarehouseOrderDetail) {
      return;
    }

    if (!selectedCatalogRecord) {
      setWarehouseOrderCompletionStatus({ tone: "error", message: "Selecciona un catalogo antes de completar el pedido." });
      return;
    }

    if (!warehouseAllItemsChecked) {
      setWarehouseOrderCompletionStatus({ tone: "error", message: "Marca todos los productos con su check antes de completar el pedido." });
      return;
    }

    try {
      setIsCompletingWarehouseOrder(true);
      setWarehouseOrderCompletionStatus(null);
      const { pdf, fileName } = await buildWarehouseInvoicePdfDocument(selectedWarehouseOrderDetail);
      pdf.save(`${fileName}.pdf`);

      const response = await fetch(`${apiBaseUrl}/warehouse/orders/${selectedWarehouseOrderDetail._id}/complete`, {
        method: "PUT",
      });
      const data = (await response.json()) as { message?: string; order?: { _id: string; status: SellerOrderRecord["status"]; updatedAt: string } };

      if (!response.ok || !data.order) {
        throw new Error(data.message ?? "No fue posible completar el pedido.");
      }

      setWarehouseOrders((current) => current.map((order) => (
        order._id === data.order?._id
          ? { ...order, status: data.order.status, updatedAt: data.order.updatedAt }
          : order
      )));
      setSelectedWarehouseOrderDetail((current) => (
        current && current._id === data.order?._id
          ? { ...current, status: data.order.status, updatedAt: data.order.updatedAt }
          : current
      ));
      await refreshInventorySummary();
      setWarehouseOrderChecklist((current) => Object.fromEntries(Object.keys(current).map((key) => [key, true])));
      setWarehouseOrderCompletionStatus({ tone: "success", message: "Factura generada y pedido marcado como completado." });
    } catch (error) {
      setWarehouseOrderCompletionStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "No fue posible completar el pedido.",
      });
    } finally {
      setIsCompletingWarehouseOrder(false);
    }
  }

  async function handlePrintCompletedOrderSummary(order: SellerOrderRecord) {
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 14;
    const generatedAt = new Date().toLocaleDateString("es-CO", { year: "numeric", month: "2-digit", day: "2-digit" });
    const logoImage = await loadImageForPdf("/company-logo.jpeg");

    pdf.setFillColor(8, 15, 28);
    pdf.rect(0, 0, pageWidth, 34, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(20);
    pdf.text("Factura comercial", margin, 16);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9.5);
    pdf.text(`Reimpresion: ${generatedAt}`, margin, 23);
    pdf.text(`Estado: ${formatSellerOrderStatus(order.status)}`, margin, 28);

    if (logoImage) {
      pdf.setFillColor(255, 255, 255);
      pdf.roundedRect(pageWidth - 46, 6, 32, 22, 4, 4, "F");
      pdf.addImage(logoImage.dataUrl, logoImage.format, pageWidth - 42, 8, 24, 18);
    }

    pdf.setTextColor(17, 17, 17);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text("Datos del pedido", margin, 46);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9.5);
    pdf.text(`Cliente: ${order.storeName}`, margin, 53);
    pdf.text(`Vendedor: ${order.salesRepName}`, margin, 59);
    pdf.text(`Ruta: ${order.routeName} · ${formatRouteDayLabel(order.routeDay as RouteDayKey)}`, margin, 65);
    pdf.text(`Fecha: ${formatSellerOrderDate(order.updatedAt)}`, margin, 71);

    let currentY = 84;
    pdf.setFillColor(244, 247, 250);
    pdf.rect(margin, currentY, pageWidth - margin * 2, 8, "F");
    pdf.setTextColor(17, 17, 17);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.5);
    pdf.text("SKU", margin + 2, currentY + 5.3);
    pdf.text("Producto", margin + 26, currentY + 5.3);
    pdf.text("Cantidad", pageWidth - 36, currentY + 5.3, { align: "right" });
    currentY += 12;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.8);

    for (const item of order.items) {
      if (currentY > pageHeight - 26) {
        pdf.addPage();
        currentY = 20;
      }

      const nameLines = pdf.splitTextToSize(item.productName, 78);
      const rowH = Math.max(7, nameLines.length * 4.6);

      pdf.text(item.productSku || "-", margin + 2, currentY);
      pdf.text(nameLines as string[], margin + 26, currentY);
      pdf.text(String(item.quantity), pageWidth - 36, currentY, { align: "right" });
      currentY += rowH + 2;
      pdf.setDrawColor(223, 229, 235);
      pdf.line(margin, currentY - 4, pageWidth - margin, currentY - 4);
    }

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    pdf.text("SPS Trading Enterprises", margin, pageHeight - 8);

    const fileName = sanitizePdfFileName(`factura-${order.storeName}-${order.routeName}-${generatedAt}`) || "factura-pedido";
    pdf.save(`${fileName}.pdf`);
  }

  function handleSectionFilterChange(field: keyof SectionFilters, value: string) {
    setSectionFilters((current) => ({
      ...current,
      [selectedCollection.key]: {
        ...(current[selectedCollection.key] ?? createInitialSectionFilters()),
        [field]: value,
      },
    }));
  }

  function handleAccountingFilterChange(key: string, field: keyof SectionFilters, value: string) {
    setAccountingFilters((current) => ({
      ...current,
      [key]: {
        ...(current[key] ?? createInitialSectionFilters()),
        [field]: value,
      },
    }));
  }

  function handlePortalInputCapture(event: FormEvent<HTMLElement>) {
    normalizeUppercaseInputTarget(event.target);
  }

  function handleCatalogFieldChange(field: keyof Omit<CatalogFormState, "categoryNames" | "productIds">, value: string) {
    setCatalogForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function toggleCatalogCategory(categoryName: string) {
    setCatalogForm((current) => ({
      ...current,
      categoryNames: current.categoryNames.includes(categoryName)
        ? current.categoryNames.filter((currentCategoryName) => currentCategoryName !== categoryName)
        : [...current.categoryNames, categoryName],
    }));
  }

  function toggleCatalogProduct(productId: string) {
    setCatalogForm((current) => ({
      ...current,
      productIds: current.productIds.includes(productId)
        ? current.productIds.filter((currentProductId) => currentProductId !== productId)
        : [...current.productIds, productId],
    }));
  }

  function resetCatalogForm(options?: { preserveStatus?: boolean }) {
    setEditingCatalogId("");
    setCatalogForm(createInitialCatalogForm());

    if (!options?.preserveStatus) {
      setCatalogStatus(null);
    }
  }

  function startCatalogEdit(catalog: CatalogRecord) {
    setEditingCatalogId(catalog._id ?? "");
    setCatalogStatus(null);
    setCatalogForm({
      name: catalog.name ?? "",
      description: catalog.description ?? "",
      categoryNames: [...(catalog.categoryNames ?? [])],
      productIds: [...(catalog.productIds ?? [])],
    });
  }

  function handleCatalogPricingValueChange(productId: string, value: string) {
    const normalizedValue = value.trim();
    setCatalogWhatsappAttachment(null);

    setCatalogPreviewItems((current) =>
      current.map((item) =>
        item.productId === productId
          ? {
              ...item,
              salePrice: normalizedValue.length === 0 ? 0 : roundCurrencyValue(Number(normalizedValue)),
            }
          : item,
      ),
    );
  }

  function applyCatalogMarkup() {
    const markupPercent = Number(catalogPricingMarkup || 0);

    setCatalogWhatsappAttachment(null);

    setCatalogPreviewItems((current) =>
      current.map((item) => ({
        ...item,
        salePrice: roundCurrencyValue(item.cost * (1 + markupPercent / 100)),
      })),
    );
  }

  function addCatalogRecipient(clientId: string) {
    const normalizedClientId = clientId.trim();

    if (!normalizedClientId || !storeOptionsById.has(normalizedClientId)) {
      return;
    }

    setCatalogWhatsappAttachment(null);

    setSelectedCatalogClientIds((current) => (
      current.includes(normalizedClientId)
        ? current
        : [...current, normalizedClientId]
    ));
  }

  function removeCatalogRecipient(clientId: string) {
    setCatalogWhatsappAttachment(null);
    setSelectedCatalogClientIds((current) => current.filter((currentClientId) => currentClientId !== clientId));
  }

  function clearCatalogRecipients() {
    setCatalogWhatsappAttachment(null);
    setSelectedCatalogClientIds([]);
  }

  function buildDefaultCatalogWhatsappMessage() {
    if (!selectedCatalogRecord) {
      return "";
    }

    return `Hola {{cliente}}, te compartimos el catalogo general ${selectedCatalogRecord.name} de SPS Trading Enterprises. Encontraras el archivo adjunto para tu revision.`;
  }

  function getCatalogWhatsappValidationError(options?: { requireAttachment?: boolean; requireMessage?: boolean }) {
    if (!selectedCatalogId) {
      return "Selecciona un catalogo antes de enviar por WhatsApp.";
    }

    if (selectedCatalogClientIds.length === 0) {
      return "Agrega al menos un cliente antes de enviar el catalogo.";
    }

    if (catalogPreviewItems.length === 0) {
      return "El catalogo seleccionado no tiene productos para enviar.";
    }

    if (!selectedCatalogRecord) {
      return "Selecciona el catalogo que deseas enviar.";
    }

    if (options?.requireMessage && !catalogWhatsappMessage.trim()) {
      return "Escribe el mensaje que deseas enviar por WhatsApp.";
    }

    if (options?.requireAttachment && !catalogWhatsappAttachment) {
      return "Adjunta el PDF generado antes de enviar el catalogo por WhatsApp.";
    }

    return "";
  }

  function toggleCatalogWhatsappComposer() {
    if (isCatalogWhatsappComposerOpen) {
      setIsCatalogWhatsappComposerOpen(false);
      setCatalogWhatsappAttachment(null);
      return;
    }

    const validationError = getCatalogWhatsappValidationError();

    if (validationError) {
      setCatalogWhatsappStatus({ tone: "error", message: validationError });
      return;
    }

    setCatalogWhatsappStatus(null);
    setIsCatalogWhatsappComposerOpen(true);
    setCatalogWhatsappMessage((current) => current.trim() || buildDefaultCatalogWhatsappMessage());
  }

  async function attachGeneratedCatalogPdfToWhatsapp() {
    const validationError = getCatalogWhatsappValidationError();

    if (validationError) {
      setCatalogWhatsappStatus({ tone: "error", message: validationError });
      return;
    }

    try {
      setIsPreparingCatalogWhatsappAttachment(true);
      setCatalogWhatsappStatus(null);
      const { pdf, fileName } = await buildCatalogPdfDocument();
      const pdfBlob = pdf.output("blob");
      const pdfFile = new File([pdfBlob], `${fileName}.pdf`, { type: "application/pdf" });

      setCatalogWhatsappAttachment({
        file: pdfFile,
        generatedAtLabel: new Date().toLocaleString("es-CO"),
      });
      setCatalogWhatsappStatus({ tone: "success", message: "PDF generado y adjuntado al envio de WhatsApp." });
    } catch (error) {
      setCatalogWhatsappStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "No fue posible adjuntar el PDF del catalogo.",
      });
    } finally {
      setIsPreparingCatalogWhatsappAttachment(false);
    }
  }

  async function buildCatalogPdfDocument() {
    if (!selectedCatalogRecord || catalogPreviewItems.length === 0) {
      throw new Error("Completa el catalogo y los productos antes de generar el PDF.");
    }

    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    const generatedAt = new Date();
    const todayLabel = generatedAt.toLocaleDateString("es-CO", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const logoImage = await loadImageForPdf("/company-logo.jpeg");
    const loadedImages = await Promise.all(
      catalogPreviewItems.map((item) => loadImageForPdf(item.imageUrl ?? "")),
    );

    const colors = {
      navy: [8, 15, 28] as const,
      orange: [255, 142, 43] as const,
      yellow: [255, 199, 48] as const,
      teal: [18, 196, 198] as const,
      mist: [244, 247, 250] as const,
      border: [223, 229, 235] as const,
      slate: [86, 96, 110] as const,
      white: [255, 255, 255] as const,
    };

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const pageMargin = 14;
    const cardGap = 8;
    const cardWidth = (pageWidth - pageMargin * 2 - cardGap) / 2;
    const cardHeight = 76;

    const drawHeader = (subtitle: string) => {
      pdf.setFillColor(...colors.navy);
      pdf.rect(0, 0, pageWidth, 40, "F");

      pdf.setFillColor(...colors.orange);
      pdf.rect(0, 40, pageWidth * 0.36, 3.5, "F");
      pdf.setFillColor(...colors.teal);
      pdf.rect(pageWidth * 0.36, 40, pageWidth * 0.28, 3.5, "F");
      pdf.setFillColor(...colors.yellow);
      pdf.rect(pageWidth * 0.64, 40, pageWidth * 0.36, 3.5, "F");

      pdf.setTextColor(...colors.white);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(22);
      pdf.text("Catalogo comercial", pageMargin, 17);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10.5);
      pdf.text(subtitle, pageMargin, 24);
      pdf.setFontSize(9);
      pdf.text(`Generado el ${todayLabel}`, pageMargin, 30);

      pdf.setFillColor(...colors.white);
      pdf.roundedRect(pageWidth - 48, 7, 34, 26, 5, 5, "F");
      if (logoImage) {
        pdf.addImage(logoImage.dataUrl, logoImage.format, pageWidth - 45, 9, 28, 22);
      }
    };

    const drawCatalogCard = (startY: number) => {
      pdf.setFillColor(...colors.white);
      pdf.setDrawColor(...colors.border);
      pdf.roundedRect(pageMargin, startY, pageWidth - pageMargin * 2, 36, 6, 6, "FD");

      pdf.setFillColor(...colors.mist);
      pdf.roundedRect(pageMargin + 4, startY + 4, 52, 28, 5, 5, "F");
      pdf.setTextColor(...colors.navy);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.text("CATALOGO", pageMargin + 8, startY + 11);
      pdf.setFontSize(16);
      const catalogNameLines = pdf.splitTextToSize(selectedCatalogRecord.name, 44);
      pdf.text(catalogNameLines, pageMargin + 8, startY + 19);

      const infoX = pageMargin + 64;
      const infoY = startY + 11;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9.5);
      pdf.setTextColor(...colors.slate);
      const details = [
        selectedCatalogRecord.description ? `Descripcion: ${selectedCatalogRecord.description}` : "",
        `Productos incluidos: ${catalogPreviewItems.length}`,
        `Clientes destino: ${selectedCatalogClients.length}`,
        "Version: general",
      ].filter(Boolean);

      let currentY = infoY;
      details.forEach((detail) => {
        const lines = pdf.splitTextToSize(detail, 112);
        pdf.text(lines, infoX, currentY);
        currentY += lines.length * 4.4;
      });
    };

    const drawProductCard = (item: CatalogPreviewItem, image: Awaited<ReturnType<typeof loadImageForPdf>>, x: number, y: number) => {
      pdf.setFillColor(...colors.white);
      pdf.setDrawColor(...colors.border);
      pdf.roundedRect(x, y, cardWidth, cardHeight, 6, 6, "FD");

      pdf.setFillColor(...colors.mist);
      pdf.roundedRect(x + 4, y + 4, cardWidth - 8, 29, 5, 5, "F");

      if (image) {
        pdf.addImage(image.dataUrl, image.format, x + 6, y + 6, 24, 24);
      } else {
        pdf.setFillColor(234, 238, 243);
        pdf.roundedRect(x + 6, y + 6, 24, 24, 4, 4, "F");
        pdf.setTextColor(...colors.slate);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7.5);
        pdf.text("SIN", x + 13, y + 17);
        pdf.text("IMAGEN", x + 10, y + 21);
      }

      pdf.setTextColor(...colors.navy);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      const nameLines = pdf.splitTextToSize(item.name, cardWidth - 40);
      pdf.text(nameLines.slice(0, 2), x + 34, y + 12);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      pdf.setTextColor(...colors.slate);
      pdf.text(`SKU: ${item.sku || "-"}`, x + 34, y + 24);
      pdf.text(`Categoria: ${item.category || "-"}`, x + 34, y + 29.5);

      const productOption = productOptionsById.get(item.productId);
      const unitLabel = formatUnitsPerBoxUnitLabel(productOption?.unitsPerBoxUnit ?? "unidad");
      const priceBlockCenterX = x + cardWidth / 2;

      pdf.setFillColor(...colors.navy);
      pdf.roundedRect(x + 6, y + 56, cardWidth - 12, 14, 5, 5, "F");
      pdf.setTextColor(...colors.white);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      pdf.text("Precio de venta", priceBlockCenterX, y + 61.5, { align: "center" });
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12.5);
      pdf.text(`${formatCurrencyUpTwoDecimals(item.salePrice)} / ${unitLabel}`, priceBlockCenterX, y + 67.5, { align: "center" });
    };

    drawHeader(selectedCatalogRecord.name);
    drawCatalogCard(51);

    let y = 95;

    for (const [index, item] of catalogPreviewItems.entries()) {
      const column = index % 2;
      const x = pageMargin + column * (cardWidth + cardGap);

      if (column === 0 && y + cardHeight > pageHeight - 18) {
        pdf.addPage();
        drawHeader(selectedCatalogRecord.name);
        y = 54;
      }

      drawProductCard(item, loadedImages[index], x, y);

      if (column === 1) {
        y += cardHeight + 8;
      }
    }

    const totalPages = pdf.getNumberOfPages();
    for (let page = 1; page <= totalPages; page += 1) {
      pdf.setPage(page);
      pdf.setDrawColor(...colors.border);
      pdf.line(pageMargin, pageHeight - 11, pageWidth - pageMargin, pageHeight - 11);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      pdf.setTextColor(...colors.slate);
      pdf.text("SPS Trading Enterprises", pageMargin, pageHeight - 6);
      pdf.text(`Pagina ${page} de ${totalPages}`, pageWidth - 34, pageHeight - 6);
    }

    const fileName = sanitizePdfFileName(`catalogo-${selectedCatalogRecord.name}-${todayLabel}`) || "catalogo-general";
    return { pdf, fileName };
  }

  async function generateCatalogPdf() {
    const { pdf, fileName } = await buildCatalogPdfDocument();
    pdf.save(`${fileName}.pdf`);
  }

  async function uploadCatalogPdf(file: File) {
    const body = new FormData();
    body.append("file", file);
    let targetCloudName = cloudinaryCloudName ?? "";

    if (cloudinaryUploadPreset) {
      body.append("upload_preset", cloudinaryUploadPreset);
      body.append("folder", "spste/catalog-pdfs");
    } else {
      const signatureResponse = await fetch(`${apiBaseUrl}/uploads/cloudinary/signature?purpose=catalog-pdfs`);
      const signatureData = (await signatureResponse.json()) as {
        message?: string;
        cloudName?: string;
        apiKey?: string;
        folder?: string;
        timestamp?: number;
        signature?: string;
      };

      if (
        !signatureResponse.ok ||
        !signatureData.cloudName ||
        !signatureData.apiKey ||
        !signatureData.folder ||
        !signatureData.timestamp ||
        !signatureData.signature
      ) {
        throw new Error(signatureData.message ?? "No fue posible preparar el catalogo para subirlo.");
      }

      targetCloudName = signatureData.cloudName;
      body.append("folder", signatureData.folder);
      body.append("api_key", signatureData.apiKey);
      body.append("timestamp", String(signatureData.timestamp));
      body.append("signature", signatureData.signature);
    }

    if (!targetCloudName) {
      throw new Error("Configura Cloudinary para subir catalogos PDF.");
    }

    const response = await fetch(`https://api.cloudinary.com/v1_1/${targetCloudName}/auto/upload`, {
      method: "POST",
      body,
    });
    const data = (await response.json()) as {
      secure_url?: string;
      error?: { message?: string };
    };

    if (!response.ok || !data.secure_url) {
      throw new Error(data.error?.message ?? "No fue posible subir el PDF del catalogo.");
    }

    return data.secure_url;
  }

  async function saveCatalogPricingForSelectedClients() {
    const response = await fetch(`${apiBaseUrl}/management/catalogs/${selectedCatalogId}/client-pricing`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientIds: selectedCatalogClientIds,
        markupPercent: Number(catalogPricingMarkup || 0),
        items: catalogPreviewItems.map((item) => ({
          productId: item.productId,
          cost: item.cost,
          salePrice: item.salePrice,
        })),
      }),
    });
    const data = (await response.json()) as { message?: string };

    if (!response.ok) {
      throw new Error(data.message ?? "No fue posible guardar los precios del catalogo.");
    }

    return data;
  }

  async function handleCatalogWhatsappSend() {
    const validationError = getCatalogWhatsappValidationError({ requireAttachment: true, requireMessage: true });

    if (validationError) {
      setCatalogWhatsappStatus({ tone: "error", message: validationError });
      return;
    }

    try {
      setIsSendingCatalogWhatsapp(true);
      setCatalogWhatsappStatus(null);
      await saveCatalogPricingForSelectedClients();
      const attachment = catalogWhatsappAttachment;

      if (!attachment) {
        throw new Error("Adjunta el PDF generado antes de enviar el catalogo por WhatsApp.");
      }

      const pdfFile = attachment.file;
      const pdfUrl = await uploadCatalogPdf(pdfFile);
      const response = await fetch(`${apiBaseUrl}/management/catalogs/${selectedCatalogId}/send-whatsapp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientIds: selectedCatalogClientIds,
          pdfUrl,
          fileName: pdfFile.name,
          message: catalogWhatsappMessage.trim(),
        }),
      });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setCatalogWhatsappStatus({ tone: "error", message: data.message ?? "No fue posible enviar el catalogo por WhatsApp." });
        return;
      }

      setCatalogWhatsappStatus({ tone: "success", message: data.message ?? "Catalogo enviado por WhatsApp correctamente." });
      setIsCatalogWhatsappComposerOpen(false);
      setCatalogWhatsappAttachment(null);
      setCatalogWhatsappMessage("");
    } catch (error) {
      setCatalogWhatsappStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "No fue posible enviar el catalogo por WhatsApp.",
      });
    } finally {
      setIsSendingCatalogWhatsapp(false);
    }
  }

  function closeCreationModal() {
    setIsCreationModalOpen(false);
    setEditingRow(null);
    setClientProductDraft(createInitialClientProductDraft());
    setIsVariableSalePrice(false);

    if (selectedCollection.key === "products") {
      clearProductImage();
    }
  }

  function closeAccountingModal() {
    setAccountingModalKind(null);
  }

  function clearAccountingStatus(key: string) {
    setAccountingStatuses((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function openImportCostPage() {
    clearAccountingStatus("importCosts");
    setEditingImportBatchReference("");
    setSelectedImportTemplateId("");
    setSaveImportAsTemplate(false);
    setImportTemplateName("");
    setContainerImportForm(createInitialContainerImportForm(productOptions));
    setAccountingView("container-import");
  }

  function closeImportCostPage() {
    setEditingImportBatchReference("");
    setSelectedImportTemplateId("");
    setSaveImportAsTemplate(false);
    setImportTemplateName("");
    setAccountingView("overview");
  }

  async function openImportBatchEdit(containerReference: string) {
    try {
      clearAccountingStatus("importCosts");
      setEditingImportBatchReference(containerReference);
      const response = await fetch(`${apiBaseUrl}/management/accounting/import-batches/${encodeURIComponent(containerReference)}`);
      const data = (await response.json()) as ImportBatchRecord | { message?: string };

      if (!response.ok || !("products" in data) || !Array.isArray(data.products)) {
        setAccountingStatuses((current) => ({
          ...current,
          importCosts: {
            tone: "error",
            message: "message" in data ? data.message ?? "No fue posible cargar la exportacion." : "No fue posible cargar la exportacion.",
          },
        }));
        return;
      }

      const productMap = new Map(data.products.map((product) => [product.productId, product]));
      setContainerImportForm({
        containerType: data.containerType ?? "seco",
        containerSize: data.containerSize ?? "20ft",
        measurementUnit: data.measurementUnit ?? "m3",
        importDate: String(data.importDate).slice(0, 10),
        shipmentReference: data.shipmentReference ?? "",
        expenseItems: (data.expenseItems ?? []).map((expense) =>
          createImportExpenseItem(expense.key, {
            label: expense.label,
            amount: String(expense.amount ?? 0),
            documents: expense.documents ?? [],
          }),
        ),
        notes: data.notes ?? "",
        products: buildContainerImportProducts(productOptions).map((product) => {
          const currentProduct = productMap.get(product.productId);

          if (!currentProduct) {
            return product;
          }

          return {
            ...product,
            selected: true,
            importedQuantity: String(currentProduct.importedQuantity ?? 0),
            purchaseUnitCostOrigin: String(currentProduct.purchaseUnitCostOrigin ?? 0),
            purchaseBoxCostOrigin:
              Number(currentProduct.purchaseUnitCostOrigin ?? 0) > 0 && Number(productOptions.find((option) => option.value === product.productId)?.unitsPerBox ?? 0) > 0
                ? String(
                    Number(currentProduct.purchaseUnitCostOrigin ?? 0) * Number(productOptions.find((option) => option.value === product.productId)?.unitsPerBox ?? 0),
                  )
                : "",
            boxCount: "",
          };
        }),
      });
      setSelectedImportTemplateId("");
      setSaveImportAsTemplate(false);
      setImportTemplateName("");
      setAccountingView("container-import");
    } catch {
      setAccountingStatuses((current) => ({
        ...current,
        importCosts: { tone: "error", message: "No fue posible conectar con el backend." },
      }));
    }
  }

  async function handleDeleteImportBatch(batch: ImportBatchSummaryRow) {
    if (!batch.containerReference) {
      return;
    }

    if (!globalThis.confirm(`Se borrara la exportacion ${batch.shipmentReference || batch.containerReference}.`)) {
      return;
    }

    try {
      clearAccountingStatus("importCosts");
      const response = await fetch(
        `${apiBaseUrl}/management/accounting/import-batches/${encodeURIComponent(batch.containerReference)}`,
        { method: "DELETE" },
      );
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setAccountingStatuses((current) => ({
          ...current,
          importCosts: {
            tone: "error",
            message: data.message ?? "No fue posible borrar la exportacion.",
          },
        }));
        return;
      }

      if (editingImportBatchReference === batch.containerReference) {
        setEditingImportBatchReference("");
        setContainerImportForm(createInitialContainerImportForm(productOptions));
        setAccountingView("overview");
      }

      setAccountingStatuses((current) => ({
        ...current,
        importCosts: {
          tone: "success",
          message: "Exportacion borrada correctamente.",
        },
      }));
      await refreshAccountingData();
    } catch {
      setAccountingStatuses((current) => ({
        ...current,
        importCosts: { tone: "error", message: "No fue posible conectar con el backend." },
      }));
    }
  }

  function addImportExpenseItem() {
    setContainerImportForm((current) => ({
      ...current,
      expenseItems: [...current.expenseItems, createImportExpenseItem()],
    }));
  }

  function removeImportExpenseItem(itemId: string) {
    setContainerImportForm((current) => ({
      ...current,
      expenseItems: current.expenseItems.filter((expense) => expense.id !== itemId),
    }));
  }

  function saveImportExpenseItem(itemId: string) {
    setContainerImportForm((current) => ({
      ...current,
      expenseItems: current.expenseItems.map((expense) =>
        expense.id === itemId ? { ...expense, saved: true } : expense,
      ),
    }));
  }

  function unsaveImportExpenseItem(itemId: string) {
    setContainerImportForm((current) => ({
      ...current,
      expenseItems: current.expenseItems.map((expense) =>
        expense.id === itemId ? { ...expense, saved: false } : expense,
      ),
    }));
  }

  function handleImportExpenseItemChange(
    itemId: string,
    field: "key" | "label" | "amount",
    value: string,
  ) {
    setContainerImportForm((current) => ({
      ...current,
      expenseItems: current.expenseItems.map((expense) => {
        if (expense.id !== itemId) {
          return expense;
        }

        if (field === "key") {
          const nextKey = value as ImportExpenseItemFormState["key"];
          const defaultLabel = importExpenseTypeOptions.find((option) => option.value === nextKey)?.label ?? "Otro";

          return {
            ...expense,
            key: nextKey,
            label: nextKey === "other" ? "" : defaultLabel,
          };
        }

        return {
          ...expense,
          [field]: value,
        };
      }),
    }));
  }

  async function handleImportExpenseDocumentUpload(itemId: string, file: File | null) {
    if (!file) {
      return;
    }

    setContainerImportForm((current) => ({
      ...current,
      expenseItems: current.expenseItems.map((expense) =>
        expense.id === itemId ? { ...expense, isUploading: true, error: "" } : expense,
      ),
    }));

    try {
      const body = new FormData();
      body.append("file", file);
      let targetCloudName = cloudinaryCloudName ?? "";

      if (cloudinaryUploadPreset) {
        body.append("upload_preset", cloudinaryUploadPreset);
        body.append("folder", "spste/import-documents");
      } else {
        const signatureResponse = await fetch(`${apiBaseUrl}/uploads/cloudinary/signature?purpose=import-documents`);
        const signatureData = (await signatureResponse.json()) as {
          message?: string;
          cloudName?: string;
          apiKey?: string;
          folder?: string;
          timestamp?: number;
          signature?: string;
        };

        if (
          !signatureResponse.ok ||
          !signatureData.cloudName ||
          !signatureData.apiKey ||
          !signatureData.folder ||
          !signatureData.timestamp ||
          !signatureData.signature
        ) {
          setContainerImportForm((current) => ({
            ...current,
            expenseItems: current.expenseItems.map((expense) =>
              expense.id === itemId
                ? {
                    ...expense,
                    isUploading: false,
                    error: signatureData.message ?? "No fue posible preparar la factura para subirla.",
                  }
                : expense,
            ),
          }));
          return;
        }

        targetCloudName = signatureData.cloudName;
        body.append("folder", signatureData.folder);
        body.append("api_key", signatureData.apiKey);
        body.append("timestamp", String(signatureData.timestamp));
        body.append("signature", signatureData.signature);
      }

      if (!targetCloudName) {
        throw new Error("Configura Cloudinary para subir facturas.");
      }

      const response = await fetch(`https://api.cloudinary.com/v1_1/${targetCloudName}/auto/upload`, {
        method: "POST",
        body,
      });
      const data = (await response.json()) as {
        secure_url?: string;
        original_filename?: string;
        error?: { message?: string };
      };

      if (!response.ok || !data.secure_url) {
        throw new Error(data.error?.message ?? "No fue posible subir la factura.");
      }

      setContainerImportForm((current) => ({
        ...current,
        expenseItems: current.expenseItems.map((expense) =>
          expense.id === itemId
            ? {
                ...expense,
                isUploading: false,
                error: "",
                documents: [
                  ...expense.documents,
                  { name: file.name || data.original_filename || "Factura", url: data.secure_url ?? "" },
                ],
              }
            : expense,
        ),
      }));
    } catch (error) {
      setContainerImportForm((current) => ({
        ...current,
        expenseItems: current.expenseItems.map((expense) =>
          expense.id === itemId
            ? {
                ...expense,
                isUploading: false,
                error: error instanceof Error ? error.message : "No fue posible subir la factura.",
              }
            : expense,
        ),
      }));
    }
  }

  function removeImportExpenseDocument(itemId: string, documentUrl: string) {
    setContainerImportForm((current) => ({
      ...current,
      expenseItems: current.expenseItems.map((expense) =>
        expense.id === itemId
          ? {
              ...expense,
              documents: expense.documents.filter((document) => document.url !== documentUrl),
            }
          : expense,
      ),
    }));
  }

  function saveCurrentImportFormAsTemplate() {
    const fallbackName = `Plantilla ${formatContainerType(containerImportForm.containerType)} ${formatContainerSize(containerImportForm.containerSize)} ${containerImportForm.measurementUnit.toUpperCase()}`;
    const nextTemplateName = importTemplateName.trim() || fallbackName;
    const now = new Date().toISOString();
    const normalizedName = nextTemplateName.toLowerCase();

    const templatePayload: Omit<ImportContainerTemplateRecord, "id"> = {
      name: nextTemplateName,
      containerType: containerImportForm.containerType,
      containerSize: containerImportForm.containerSize,
      measurementUnit: containerImportForm.measurementUnit,
      notes: containerImportForm.notes,
      expenseItems: containerImportForm.expenseItems.map((expense) => ({
        key: expense.key,
        label: expense.label,
        amount: Number(expense.amount || 0),
        documents: expense.documents,
      })),
      products: containerImportForm.products.map((product) => ({ ...product })),
      updatedAt: now,
    };

    let storedName = nextTemplateName;

    setImportContainerTemplates((current) => {
      const existingTemplate = current.find((template) => template.name.trim().toLowerCase() === normalizedName);

      if (existingTemplate) {
        storedName = existingTemplate.name;
        return current.map((template) =>
          template.id === existingTemplate.id
            ? {
                ...templatePayload,
                id: existingTemplate.id,
                name: existingTemplate.name,
              }
            : template,
        );
      }

      const createdTemplate: ImportContainerTemplateRecord = {
        ...templatePayload,
        id: `import-template-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      };

      storedName = createdTemplate.name;
      return [createdTemplate, ...current].slice(0, 30);
    });

    return storedName;
  }

  function applySelectedImportTemplate(templateId: string) {
    const selectedTemplate = importContainerTemplates.find((template) => template.id === templateId);

    if (!selectedTemplate) {
      return;
    }

    const productsById = new Map(selectedTemplate.products.map((product) => [product.productId, product]));

    setContainerImportForm((current) => ({
      ...current,
      containerType: selectedTemplate.containerType,
      containerSize: selectedTemplate.containerSize,
      measurementUnit: selectedTemplate.measurementUnit,
      notes: selectedTemplate.notes,
      expenseItems: selectedTemplate.expenseItems.map((expense) =>
        createImportExpenseItem(expense.key, {
          label: expense.label,
          amount: String(expense.amount),
          documents: expense.documents,
        }),
      ),
      products: buildContainerImportProducts(productOptions).map((product) => {
        const templateProduct = productsById.get(product.productId);

        if (!templateProduct) {
          return product;
        }

        return {
          ...product,
          selected: templateProduct.selected,
          boxCount: templateProduct.boxCount,
          importedQuantity: templateProduct.importedQuantity,
          purchaseUnitCostOrigin: templateProduct.purchaseUnitCostOrigin,
          purchaseBoxCostOrigin: templateProduct.purchaseBoxCostOrigin,
        };
      }),
    }));

    setAccountingStatuses((current) => ({
      ...current,
      importCosts: { tone: "success", message: `Plantilla ${selectedTemplate.name} aplicada.` },
    }));
  }

  function openCreationModal() {
    setEditingRow(null);
    setIsCreationModalOpen(true);
    setClientProductDraft(createInitialClientProductDraft());

    if (selectedCollection.key === "products") {
      setIsVariableSalePrice(false);
      clearProductImage();
    }
  }

  function loadExistingProductImage(imageUrl: string) {
    if (productImage.previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(productImage.previewUrl);
    }

    setProductImage({
      previewUrl: imageUrl,
      uploadedUrl: imageUrl,
      isUploading: false,
      error: "",
    });
    setProductImageInputKey((current) => current + 1);
  }

  function openEditModal(row: Record<string, unknown>) {
    setEditingRow(row);
    setIsCreationModalOpen(true);

    if (selectedCollection.key === "clients") {
      const assignedProductIds = Array.isArray(row.assignedProductIds)
        ? row.assignedProductIds.map((entry) => String(entry)).filter(Boolean)
        : [];

      setClientProductDraft({ productIds: assignedProductIds });
    } else {
      setClientProductDraft(createInitialClientProductDraft());
    }

    if (selectedCollection.key === "products") {
      setIsVariableSalePrice(getProductVariableSalePriceValue(row));
      const existingImageUrl = typeof row.imageUrl === "string" ? row.imageUrl.trim() : "";

      if (existingImageUrl) {
        loadExistingProductImage(existingImageUrl);
      } else {
        clearProductImage();
      }
    }
  }

  async function handleDeleteCreationRow(config: CollectionConfig, row: Record<string, unknown>) {
    const rowId = typeof row._id === "string" ? row._id : "";

    if (!rowId) {
      setCreationStatuses((current) => ({
        ...current,
        [config.key]: { tone: "error", message: "No fue posible identificar el registro que deseas borrar." },
      }));
      return;
    }

    if (!globalThis.confirm(`Se borrara este registro de ${getOptionLabel(config.title).toLowerCase()}.`)) {
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}${config.endpoint}/${rowId}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setCreationStatuses((current) => ({
          ...current,
          [config.key]: { tone: "error", message: data.message ?? "No fue posible borrar el registro." },
        }));
        return;
      }

      setCreationStatuses((current) => ({
        ...current,
        [config.key]: { tone: "success", message: "Registro borrado correctamente." },
      }));

      await Promise.all([refreshKpis(), refreshCreationRows(config, { silent: true }), refreshReferenceOptions()]);
    } catch {
      setCreationStatuses((current) => ({
        ...current,
        [config.key]: { tone: "error", message: "No fue posible conectar con el backend." },
      }));
    }
  }

  function handleRouteFieldChange(field: keyof Omit<RouteFormState, "dayAssignments">, value: string) {
    setRouteForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleSellerOrderDraftChange(productId: string, field: "stockCurrent" | "quantity" | "notes", value: string) {
    setSellerOrderDraft((current) => ({
      ...current,
      [productId]: {
        stockCurrent: current[productId]?.stockCurrent ?? "",
        quantity: current[productId]?.quantity ?? "",
        notes: current[productId]?.notes ?? "",
        [field]: value,
      },
    }));
  }

  function openSellerOrderEdit(order: SellerOrderRecord) {
    if (!canEditSellerOrder(order.createdAt)) {
      setSellerOrderExpiredNotice(order);
      return;
    }

    setSellerOrderEditStatus(null);
    setSellerOrderEditDraft(Object.fromEntries(order.items.map((item) => [item.productId, String(item.quantity)])));
    setSelectedSellerOrderEdit(order);
  }

  async function handleSellerOrderEditSubmit() {
    if (!sessionUser || sessionUser.role !== "sales-rep-aruba" || !selectedSellerOrderEdit) {
      return;
    }

    const nextItems = selectedSellerOrderEdit.items.map((item) => ({
      ...item,
      quantity: Number(sellerOrderEditDraft[item.productId] ?? item.quantity),
    }));

    if (nextItems.some((item) => !Number.isFinite(item.quantity) || item.quantity < 0)) {
      setSellerOrderEditStatus({ tone: "error", message: "Todas las cantidades del pedido deben ser cero o mayores." });
      return;
    }

    try {
      setIsSavingSellerOrderEdit(true);
      setSellerOrderEditStatus(null);
      const response = await fetch(`${apiBaseUrl}/sales/orders/${selectedSellerOrderEdit._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routeId: selectedSellerOrderEdit.routeId,
          routeName: selectedSellerOrderEdit.routeName,
          routeDay: selectedSellerOrderEdit.routeDay,
          storeId: selectedSellerOrderEdit.storeId,
          salesRepId: sessionUser.id,
          items: nextItems.map((item) => ({
            productId: item.productId,
            stockCurrent: item.stockCurrent,
            quantity: item.quantity,
            notes: item.notes,
          })),
        }),
      });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        const message = data.message ?? "No fue posible actualizar el pedido.";

        if (message.includes("ha caducado")) {
          setSelectedSellerOrderEdit(null);
          setSellerOrderExpiredNotice(selectedSellerOrderEdit);
          return;
        }

        setSellerOrderEditStatus({ tone: "error", message });
        return;
      }

      await refreshSellerOrders(sessionUser.id);
      setSelectedSellerOrderEdit(null);
      setSellerOrderEditDraft({});
    } catch {
      setSellerOrderEditStatus({ tone: "error", message: "No fue posible conectar con el backend." });
    } finally {
      setIsSavingSellerOrderEdit(false);
    }
  }

  async function handleSellerOrderSubmit() {
    if (!sessionUser || sessionUser.role !== "sales-rep-aruba") {
      return;
    }

    if (!selectedSellerStore) {
      setSellerOrderStatus({ tone: "error", message: "Selecciona un cliente de la ruta antes de enviar el pedido." });
      return;
    }

    if (!selectedSellerRoute || !selectedSellerDayKey) {
      setSellerOrderStatus({ tone: "error", message: "Selecciona la ruta y el dia activo antes de enviar el pedido." });
      return;
    }

    if (sellerDraftedItems.length === 0) {
      setSellerOrderStatus({ tone: "error", message: "Agrega stock actual o cantidad en al menos un producto antes de enviar el registro a bodega." });
      return;
    }

    try {
      setIsSubmittingSellerOrder(true);
      setSellerOrderStatus(null);
      const response = await fetch(`${apiBaseUrl}/sales/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routeId: selectedSellerRoute._id ?? selectedSellerRoute.code,
          routeName: selectedSellerRoute.name,
          routeDay: selectedSellerDayKey,
          storeId: selectedSellerStore.storeId,
          salesRepId: sessionUser.id,
          items: sellerDraftedItems,
        }),
      });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setSellerOrderStatus({ tone: "error", message: data.message ?? "No fue posible enviar el pedido a bodega." });
        return;
      }

      setSellerOrderDraft({});
      setSellerOrderStatus({ tone: "success", message: data.message ?? "Pedido enviado a bodega correctamente." });
      await refreshSellerOrders(sessionUser.id);
    } catch {
      setSellerOrderStatus({ tone: "error", message: "No fue posible conectar con el backend." });
    } finally {
      setIsSubmittingSellerOrder(false);
    }
  }

  function resetRouteForm() {
    setEditingRouteId("");
    setRouteStatus(null);
    setRouteForm((current) => ({
      ...createInitialRouteForm(),
      salesRepId: current.salesRepId,
    }));
  }

  function startRouteEdit(route: SalesRouteRecord) {
    const dayAssignments = createEmptyDayAssignments();

    route.days.forEach((day) => {
      dayAssignments[day.day] = day.stores.map((store) => store.storeId);
    });

    setEditingRouteId(route._id ?? "");
    setRouteStatus(null);
    setRouteForm({
      name: route.name ?? "",
      salesRepId: route.salesRepId ?? "",
      weekStart: route.weekStart ? String(route.weekStart).slice(0, 10) : getCurrentWeekStart(),
      notes: route.notes ?? "",
      dayAssignments,
    });
  }

  function toggleStoreForDay(day: RouteDayKey, storeId: string) {
    setRouteForm((current) => {
      const selectedStores = current.dayAssignments[day];
      const hasStore = selectedStores.includes(storeId);

      return {
        ...current,
        dayAssignments: {
          ...current.dayAssignments,
          [day]: hasStore
            ? selectedStores.filter((currentStoreId) => currentStoreId !== storeId)
            : [...selectedStores, storeId],
        },
      };
    });
  }

  async function handleProductImageChange(file: File | null) {
    if (!file) {
      setProductImage({ previewUrl: "", uploadedUrl: "", isUploading: false, error: "" });
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setProductImage({ previewUrl, uploadedUrl: "", isUploading: true, error: "" });

    try {
      const body = new FormData();
      body.append("file", file);
      let targetCloudName = cloudinaryCloudName ?? "";

      if (cloudinaryUploadPreset) {
        body.append("upload_preset", cloudinaryUploadPreset);
        body.append("folder", "spste/products");
      } else {
        const signatureResponse = await fetch(`${apiBaseUrl}/uploads/cloudinary/signature`);
        const signatureData = (await signatureResponse.json()) as {
          message?: string;
          cloudName?: string;
          apiKey?: string;
          folder?: string;
          timestamp?: number;
          signature?: string;
        };

        if (
          !signatureResponse.ok ||
          !signatureData.cloudName ||
          !signatureData.apiKey ||
          !signatureData.folder ||
          !signatureData.timestamp ||
          !signatureData.signature
        ) {
          setProductImage((current) => ({
            ...current,
            isUploading: false,
            error: signatureData.message ?? "No fue posible preparar la subida a Cloudinary.",
          }));
          return;
        }

        targetCloudName = signatureData.cloudName;
        body.append("folder", signatureData.folder);
        body.append("api_key", signatureData.apiKey);
        body.append("timestamp", String(signatureData.timestamp));
        body.append("signature", signatureData.signature);
      }

      if (!targetCloudName) {
        setProductImage((current) => ({
          ...current,
          isUploading: false,
          error: "Configura Cloudinary para subir la imagen y obtener su link.",
        }));
        return;
      }

      const response = await fetch(`https://api.cloudinary.com/v1_1/${targetCloudName}/image/upload`, {
        method: "POST",
        body,
      });
      const data = (await response.json()) as { secure_url?: string; error?: { message?: string } };

      if (!response.ok || !data.secure_url) {
        setProductImage((current) => ({
          ...current,
          isUploading: false,
          error: data.error?.message ?? "No fue posible subir la imagen.",
        }));
        return;
      }

      setProductImage((current) => ({
        ...current,
        uploadedUrl: data.secure_url ?? "",
        isUploading: false,
        error: "",
      }));
    } catch {
      setProductImage((current) => ({
        ...current,
        isUploading: false,
        error: "No fue posible subir la imagen.",
      }));
    }
  }

  function clearProductImage() {
    if (productImage.previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(productImage.previewUrl);
    }

    setProductImage({ previewUrl: "", uploadedUrl: "", isUploading: false, error: "" });
    setProductImageInputKey((current) => current + 1);
  }

  function handleWarehouseLocationFieldChange(field: keyof WarehouseLocationFormState, value: string) {
    setWarehouseLocationForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function toggleClientDraftProduct(productId: string) {
    setClientProductDraft((current) => ({
      productIds: current.productIds.includes(productId)
        ? current.productIds.filter((currentProductId) => currentProductId !== productId)
        : [...current.productIds, productId],
    }));
  }

  function handleContainerImportFieldChange(
    field: "containerType" | "containerSize" | "measurementUnit" | "importDate" | "shipmentReference" | "notes",
    value: string,
  ) {
    setContainerImportForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function toggleContainerImportProduct(productId: string) {
    setContainerImportForm((current) => ({
      ...current,
      products: current.products.map((product) =>
        product.productId === productId ? { ...product, selected: !product.selected } : product,
      ),
    }));
  }

  function handleContainerImportProductFieldChange(
    productId: string,
    field: "boxCount" | "importedQuantity" | "purchaseUnitCostOrigin" | "purchaseBoxCostOrigin",
    value: string,
  ) {
    const relatedProduct = productOptions.find((product) => product.value === productId);
    const unitsPerBox = Number(relatedProduct?.unitsPerBox ?? 0);

    setContainerImportForm((current) => ({
      ...current,
      products: current.products.map((product) =>
        product.productId === productId
          ? (() => {
              if (field === "boxCount") {
                const normalizedBoxes = value.trim();
                const parsedBoxes = Number(normalizedBoxes || 0);

                return {
                  ...product,
                  selected: normalizedBoxes.length > 0 ? true : product.selected,
                  boxCount: normalizedBoxes,
                  importedQuantity:
                    normalizedBoxes.length > 0 && unitsPerBox > 0 && parsedBoxes >= 0
                      ? String(parsedBoxes * unitsPerBox)
                      : normalizedBoxes.length === 0
                        ? ""
                        : product.importedQuantity,
                };
              }

              if (field === "purchaseBoxCostOrigin") {
                const normalizedBoxCost = value.trim();
                const parsedBoxCost = Number(normalizedBoxCost || 0);

                return {
                  ...product,
                  selected: normalizedBoxCost.length > 0 ? true : product.selected,
                  purchaseBoxCostOrigin: normalizedBoxCost,
                  purchaseUnitCostOrigin:
                    normalizedBoxCost.length > 0 && unitsPerBox > 0 && parsedBoxCost >= 0
                      ? String(parsedBoxCost / unitsPerBox)
                      : normalizedBoxCost.length === 0
                        ? ""
                        : product.purchaseUnitCostOrigin,
                };
              }

              if (field === "purchaseUnitCostOrigin") {
                const normalizedUnitCost = value.trim();
                const parsedUnitCost = Number(normalizedUnitCost || 0);

                return {
                  ...product,
                  selected: normalizedUnitCost.length > 0 ? true : product.selected,
                  purchaseUnitCostOrigin: normalizedUnitCost,
                  purchaseBoxCostOrigin:
                    normalizedUnitCost.length > 0 && unitsPerBox > 0 && parsedUnitCost >= 0
                      ? String(parsedUnitCost * unitsPerBox)
                      : normalizedUnitCost.length === 0
                        ? ""
                        : product.purchaseBoxCostOrigin,
                };
              }

              return {
                ...product,
                selected: value.trim().length > 0 ? true : product.selected,
                [field]: value,
              };
            })()
          : product,
      ),
    }));
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsAuthenticating(true);
    setLoginError("");

    try {
      const response = await fetch(`${apiBaseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await response.json()) as SessionUser | { message?: string };

      if (!response.ok) {
        setLoginError("message" in data ? data.message ?? "No fue posible iniciar sesion." : "No fue posible iniciar sesion.");
        return;
      }

      if (!("role" in data) || !data.role) {
        setLoginError("No fue posible identificar el rol del usuario.");
        return;
      }

      setSessionUser(data);
    } catch {
      setLoginError("No fue posible conectar con el backend.");
    } finally {
      setIsAuthenticating(false);
    }
  }

  function handleLogout() {
    setSessionUser(null);
  }

  async function handleCreationSubmit(event: FormEvent<HTMLFormElement>, config: CollectionConfig) {
    event.preventDefault();

    const form = event.currentTarget;
    const editingId = typeof editingRow?._id === "string" ? editingRow._id : "";
    const isEditing = editingId.length > 0;
    const payload = buildPayload(new FormData(form), config.fields) as Record<string, string | number | boolean | string[] | null> & {
      imageUrl?: string;
    };

    if (config.key === "products") {
      payload.variableSalePrice = Boolean(editingRow?.variableSalePrice ?? false);
      payload.salePrice = Number(editingRow?.salePrice ?? 0);
      payload.cost = 0;
      payload.arubaPurchaseCostUsd = Number(editingRow?.arubaPurchaseCostUsd ?? 0);
      payload.arubaUsdToAwgRate = Number(editingRow?.arubaUsdToAwgRate ?? 1.79);
      payload.expirationDate = typeof editingRow?.expirationDate === "string" ? editingRow.expirationDate : null;

      if (productImage.isUploading) {
        setCreationStatuses((current) => ({
          ...current,
          [config.key]: { tone: "error", message: "La imagen aun se esta subiendo a Cloudinary." },
        }));
        return;
      }

      if (productImage.error) {
        setCreationStatuses((current) => ({
          ...current,
          [config.key]: { tone: "error", message: productImage.error },
        }));
        return;
      }

      if (productImage.uploadedUrl) {
        payload.imageUrl = productImage.uploadedUrl;
      } else if (isEditing && typeof editingRow?.imageUrl === "string" && editingRow.imageUrl.trim()) {
        payload.imageUrl = editingRow.imageUrl;
      }
    }

    if (config.key === "clients") {
      payload.assignedProductIds = clientProductDraft.productIds;
    }

    try {
      const response = await fetch(`${apiBaseUrl}${config.endpoint}${isEditing ? `/${editingId}` : ""}`, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setCreationStatuses((current) => ({
          ...current,
          [config.key]: { tone: "error", message: data.message ?? "No fue posible guardar el registro." },
        }));
        return;
      }

      form.reset();
      if (config.key === "products") {
        clearProductImage();
      }

      setCreationStatuses((current) => ({
        ...current,
        [config.key]: {
          tone: "success",
          message: isEditing ? "Registro actualizado correctamente." : `${config.title} guardado correctamente.`,
        },
      }));

      closeCreationModal();

      await refreshKpis();

      const listData = await refreshCreationRows(config, { silent: true });

      if (!listData) {
        return;
      }

      if (config.key === "categories") {
        setCategoryOptions(
          listData
            .map((category) => ({ value: String(category.name ?? ""), label: String(category.name ?? "") }))
            .filter((category) => category.value.length > 0),
        );
      }

      if (config.key === "suppliers") {
        setSupplierOptions(
          listData
            .map((supplier) => ({ value: String(supplier.name ?? ""), label: String(supplier.name ?? "") }))
            .filter((supplier) => supplier.value.length > 0),
        );
      }

      if (config.key === "clients") {
        setStoreOptions(
          listData
            .map((client) => ({
              value: String(client._id ?? ""),
              label: String(client.name ?? ""),
              address: String(client.address ?? ""),
              code: String(client.code ?? ""),
              email: String(client.email ?? ""),
              phone: String(client.phone ?? ""),
              managerName: String(client.managerName ?? ""),
              assignedProductIds: Array.isArray(client.assignedProductIds)
                ? client.assignedProductIds.map((entry) => String(entry)).filter(Boolean)
                : [],
            }))
            .filter((client) => client.value.length > 0 && client.label.length > 0),
        );
      }

      if (config.key === "products") {
        const nextProductOptions = listData
          .filter((product) => product.active !== false)
          .map((product) => ({
            value: String(product._id ?? ""),
            label: String(product.name ?? ""),
            sku: String(product.sku ?? ""),
            salePrice: roundCurrencyValue(Number(product.salePrice ?? 0)),
            productWeightKg: Number(product.productWeightKg ?? 0),
            variableSalePrice: Boolean(product.variableSalePrice),
            unitsPerBox: Number(product.unitsPerBox ?? 0),
            unitsPerBoxUnit: String(product.unitsPerBoxUnit ?? "unidad"),
            boxLengthCm: Number(product.boxLengthCm ?? 0),
            boxWidthCm: Number(product.boxWidthCm ?? 0),
            boxHeightCm: Number(product.boxHeightCm ?? 0),
          }))
          .filter((product) => product.value.length > 0 && product.label.length > 0);

        setProductOptions(nextProductOptions);
        setWarehouseLocationForm((current) => ({
          ...current,
          productId: nextProductOptions[0]?.value || current.productId,
        }));
      }

      if (config.key === "warehouses") {
        const nextWarehouseOptions = listData
          .filter((warehouse) => warehouse.active !== false)
          .map((warehouse) => ({
            value: String(warehouse._id ?? ""),
            label: String(warehouse.name ?? ""),
            code: String(warehouse.code ?? ""),
            address: String(warehouse.address ?? ""),
          }))
          .filter((warehouse) => warehouse.value.length > 0 && warehouse.label.length > 0);

        setWarehouseOptions(nextWarehouseOptions);
        setSelectedWarehouseId((current) => current || nextWarehouseOptions[0]?.value || "");
      }

      if (config.key === "users") {
        setSalesRepOptions(
          listData
            .filter((user) => user.role === "sales-rep-aruba" && user.active !== false)
            .map((user) => ({
              value: String(user._id ?? ""),
              label: String(user.name ?? user.email ?? "Vendedor sin nombre"),
            }))
            .filter((user) => user.value.length > 0),
        );
      }
    } catch {
      setCreationStatuses((current) => ({
        ...current,
        [config.key]: { tone: "error", message: "No fue posible conectar con el backend." },
      }));
    }
  }

  function formatCreationCellValue(row: Record<string, unknown>, key: string) {
    if (key === "assignedProductIds") {
      const assignedProductIds = Array.isArray(row.assignedProductIds)
        ? row.assignedProductIds.map((entry) => String(entry)).filter(Boolean)
        : [];

      return `${assignedProductIds.length} producto${assignedProductIds.length === 1 ? "" : "s"}`;
    }

    if (key === "salePrice" && row.variableSalePrice === true) {
      return "Variable";
    }

    if (key === "expirationDate") {
      const rawValue = row[key];

      if (!rawValue) {
        return "-";
      }

      const date = new Date(String(rawValue));
      return Number.isNaN(date.getTime()) ? "-" : date.toISOString().slice(0, 10);
    }

    return formatCellValue(row[key]);
  }

  async function handleWarehouseLocationSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedWarehouseId) {
      setWarehouseLocationStatus({ tone: "error", message: "Selecciona una bodega antes de guardar." });
      return;
    }

    if (
      !warehouseLocationForm.productId ||
      !warehouseLocationForm.shelf.trim() ||
      !warehouseLocationForm.floor.trim() ||
      !warehouseLocationForm.rack.trim()
    ) {
      setWarehouseLocationStatus({
        tone: "error",
        message: "Completa producto, estante, piso y rack antes de guardar.",
      });
      return;
    }

    try {
      setIsSavingWarehouseLocation(true);
      setWarehouseLocationStatus(null);
      const response = await fetch(`${apiBaseUrl}/management/warehouse-locations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouseId: selectedWarehouseId,
          productId: warehouseLocationForm.productId,
          shelf: warehouseLocationForm.shelf.trim(),
          floor: warehouseLocationForm.floor.trim(),
          rack: warehouseLocationForm.rack.trim(),
        }),
      });
      const data = (await response.json()) as WarehouseLocationRecord | { message?: string };

      if (!response.ok) {
        setWarehouseLocationStatus({
          tone: "error",
          message:
            "message" in data
              ? data.message ?? "No fue posible guardar la ubicacion del producto."
              : "No fue posible guardar la ubicacion del producto.",
        });
        return;
      }

      setEditingWarehouseLocationId("");
      setWarehouseLocationForm((current) => ({
        ...createInitialWarehouseLocationForm(),
        productId: current.productId,
      }));
      setWarehouseLocationStatus({ tone: "success", message: "Ubicacion de bodega guardada correctamente." });
      await refreshWarehouseLocations(selectedWarehouseId);
    } catch {
      setWarehouseLocationStatus({ tone: "error", message: "No fue posible conectar con el backend." });
    } finally {
      setIsSavingWarehouseLocation(false);
    }
  }

  function startWarehouseLocationEdit(location: WarehouseLocationRecord) {
    setWarehouseLocationStatus(null);
    setEditingWarehouseLocationId(location._id ?? location.productId);
    setWarehouseLocationForm({
      productId: location.productId,
      shelf: location.shelf,
      floor: location.floor,
      rack: location.rack,
    });
  }

  function cancelWarehouseLocationEdit() {
    setEditingWarehouseLocationId("");
    setWarehouseLocationStatus(null);
    setWarehouseLocationForm((current) => ({
      ...createInitialWarehouseLocationForm(),
      productId: current.productId,
    }));
  }

  async function handleDeleteWarehouseLocation(location: WarehouseLocationRecord) {
    const locationId = typeof location._id === "string" ? location._id : "";

    if (!locationId) {
      setWarehouseLocationStatus({ tone: "error", message: "No fue posible identificar la ubicacion seleccionada." });
      return;
    }

    if (!globalThis.confirm(`Se borrara la ubicacion de ${location.productName}.`)) {
      return;
    }

    try {
      setWarehouseLocationStatus(null);
      const response = await fetch(`${apiBaseUrl}/management/warehouse-locations/${locationId}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setWarehouseLocationStatus({
          tone: "error",
          message: data.message ?? "No fue posible borrar la ubicacion del producto.",
        });
        return;
      }

      if (editingWarehouseLocationId === locationId) {
        cancelWarehouseLocationEdit();
      }

      setWarehouseLocationStatus({ tone: "success", message: "Ubicacion de bodega borrada correctamente." });
      await refreshWarehouseLocations(selectedWarehouseId);
    } catch {
      setWarehouseLocationStatus({ tone: "error", message: "No fue posible conectar con el backend." });
    }
  }

  async function handleImportCostSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const selectedProducts = containerImportForm.products.filter((product) => product.selected);

    if (selectedProducts.length === 0) {
      setAccountingStatuses((current) => ({
        ...current,
        importCosts: { tone: "error", message: "Selecciona al menos un producto del contenedor." },
      }));
      return;
    }

    if (!containerImportForm.shipmentReference.trim()) {
      setAccountingStatuses((current) => ({
        ...current,
        importCosts: { tone: "error", message: "Ingresa el nombre o tracking de envio antes de guardar." },
      }));
      return;
    }

    const invalidSelection = selectedProducts.find(
      (product) =>
        Number(product.importedQuantity || 0) < 0 ||
        Number(product.purchaseUnitCostOrigin || 0) < 0 ||
        Number(product.purchaseBoxCostOrigin || 0) < 0,
    );

    if (invalidSelection) {
      const invalidProduct = productOptions.find((option) => option.value === invalidSelection.productId);
      setAccountingStatuses((current) => ({
        ...current,
        importCosts: {
          tone: "error",
          message: `Revisa cantidad, costo unitario o costo x caja para ${invalidProduct?.label ?? "el producto seleccionado"}.`,
        },
      }));
      return;
    }

    const invalidExpense = containerImportForm.expenseItems.find((expense) => {
      const amount = Number(expense.amount || 0);

      if (expense.isUploading) {
        return true;
      }

      if (expense.key === "other" && !expense.label.trim()) {
        return true;
      }

      return amount < 0;
    });

    if (invalidExpense) {
      setAccountingStatuses((current) => ({
        ...current,
        importCosts: {
          tone: "error",
          message: invalidExpense.isUploading
            ? "Espera a que la factura termine de subirse antes de guardar la exportacion."
            : "Revisa el nombre y el valor de los gastos agregados.",
        },
      }));
      return;
    }

    if (selectedContainerMetricsWithoutVolume.length > 0) {
      setAccountingStatuses((current) => ({
        ...current,
        importCosts: {
          tone: "error",
          message: containerImportForm.measurementUnit === "kg"
            ? `Configura el peso por unidad para ${selectedContainerMetricsWithoutVolume[0].product.label} antes de planear este contenedor por peso.`
            : `Configura unidades por caja y dimensiones para ${selectedContainerMetricsWithoutVolume[0].product.label} antes de planear este contenedor.`,
        },
      }));
      return;
    }

    if (selectedContainerOverflowByUnit > 0) {
      setAccountingStatuses((current) => ({
        ...current,
        importCosts: {
          tone: "error",
          message: `El contenedor supera su capacidad por ${formatContainerMeasure(selectedContainerOverflowByUnit, containerImportForm.measurementUnit)}. Ajusta cantidades o cambia el tamano del contenedor.`,
        },
      }));
      return;
    }

    try {
      setIsSavingImportCost(true);
      clearAccountingStatus("importCosts");
      const response = await fetch(
        `${apiBaseUrl}/management/accounting/${editingImportBatchReference ? `import-batches/${encodeURIComponent(editingImportBatchReference)}` : "import-costs"}`,
        {
        method: editingImportBatchReference ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          containerType: containerImportForm.containerType,
          containerSize: containerImportForm.containerSize,
          measurementUnit: containerImportForm.measurementUnit,
          importDate: containerImportForm.importDate,
          shipmentReference: containerImportForm.shipmentReference.trim(),
          expenseItems: containerImportForm.expenseItems.map((expense) => ({
            key: expense.key,
            label: expense.key === "other" ? expense.label.trim() : expense.label,
            amount: Number(expense.amount || 0),
            documents: expense.documents,
          })),
          notes: containerImportForm.notes.trim(),
          products: selectedProducts.map((product) => ({
            productId: product.productId,
            importedQuantity: Number(product.importedQuantity || 0),
            purchaseUnitCostOrigin: Number(product.purchaseUnitCostOrigin || 0),
            purchaseBoxCostOrigin: Number(product.purchaseBoxCostOrigin || 0),
          })),
        }),
      });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setAccountingStatuses((current) => ({
          ...current,
          importCosts: { tone: "error", message: data.message ?? "No fue posible guardar el costo de exportacion." },
        }));
        return;
      }

      const storedTemplateName = saveImportAsTemplate ? saveCurrentImportFormAsTemplate() : "";

      setAccountingStatuses((current) => ({
        ...current,
        importCosts: {
          tone: "success",
          message: editingImportBatchReference
            ? `Exportacion actualizada correctamente.${storedTemplateName ? ` Plantilla ${storedTemplateName} guardada.` : ""}`
            : `Exportacion guardada para ${selectedProducts.length} producto${selectedProducts.length === 1 ? "" : "s"}.${storedTemplateName ? ` Plantilla ${storedTemplateName} guardada.` : ""}`,
        },
      }));
      setEditingImportBatchReference("");
      setSelectedImportTemplateId("");
      setSaveImportAsTemplate(false);
      setImportTemplateName("");
      setContainerImportForm(createInitialContainerImportForm(productOptions));
      setAccountingView("overview");
      await refreshAccountingData();
    } catch {
      setAccountingStatuses((current) => ({
        ...current,
        importCosts: { tone: "error", message: "No fue posible conectar con el backend." },
      }));
    } finally {
      setIsSavingImportCost(false);
    }
  }

  async function handleFixedCostSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const formData = new FormData(event.currentTarget);
      const response = await fetch(`${apiBaseUrl}/management/accounting/fixed-costs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(formData.get("name") ?? ""),
          category: String(formData.get("category") ?? ""),
          frequency: String(formData.get("frequency") ?? ""),
          amount: Number(formData.get("amount") ?? 0),
          startDate: String(formData.get("startDate") ?? ""),
          notes: String(formData.get("notes") ?? ""),
        }),
      });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setAccountingStatuses((current) => ({
          ...current,
          fixedCosts: { tone: "error", message: data.message ?? "No fue posible guardar el costo fijo." },
        }));
        return;
      }

      setAccountingStatuses((current) => ({
        ...current,
        fixedCosts: { tone: "success", message: "Costo fijo guardado correctamente." },
      }));
      closeAccountingModal();
      await refreshAccountingData();
    } catch {
      setAccountingStatuses((current) => ({
        ...current,
        fixedCosts: { tone: "error", message: "No fue posible conectar con el backend." },
      }));
    }
  }

  async function handleOperationalExpenseSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const formData = new FormData(event.currentTarget);
      const response = await fetch(`${apiBaseUrl}/management/accounting/operational-expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(formData.get("name") ?? ""),
          category: String(formData.get("category") ?? ""),
          amount: Number(formData.get("amount") ?? 0),
          expenseDate: String(formData.get("expenseDate") ?? ""),
          notes: String(formData.get("notes") ?? ""),
        }),
      });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setAccountingStatuses((current) => ({
          ...current,
          operationalExpenses: { tone: "error", message: data.message ?? "No fue posible guardar el gasto operacional." },
        }));
        return;
      }

      setAccountingStatuses((current) => ({
        ...current,
        operationalExpenses: { tone: "success", message: "Gasto operacional guardado correctamente." },
      }));
      closeAccountingModal();
      await refreshAccountingData();
    } catch {
      setAccountingStatuses((current) => ({
        ...current,
        operationalExpenses: { tone: "error", message: "No fue posible conectar con el backend." },
      }));
    }
  }

  async function handleCreateLogisticsInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const items = logisticsInvoiceForm.items.map((item) => ({
        productId: item.productId || item.productName,
        productName: item.productName,
        productSku: item.productSku,
        quantity: Number(item.quantity ?? 0),
        salePriceAwg: Number(item.salePriceAwg ?? 0),
        unitCostAwg: Number(item.unitCostAwg ?? 0),
      }));

      const response = await fetch(`${apiBaseUrl}/management/logistics-accounting/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeName: logisticsInvoiceForm.storeName,
          salesRepName: logisticsInvoiceForm.salesRepName,
          routeName: logisticsInvoiceForm.routeName,
          invoiceDate: logisticsInvoiceForm.invoiceDate,
          notes: logisticsInvoiceForm.notes,
          items,
        }),
      });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setLogisticsAccountingStatuses((current) => ({
          ...current,
          invoice: { tone: "error", message: data.message ?? "No fue posible registrar la factura." },
        }));
        return;
      }

      setLogisticsAccountingModalKind(null);
      setLogisticsInvoiceForm(createInitialLogisticsInvoiceForm());
      await refreshLogisticsAccountingData();
    } catch {
      setLogisticsAccountingStatuses((current) => ({
        ...current,
        invoice: { tone: "error", message: "No fue posible conectar con el backend." },
      }));
    }
  }

  async function handleCreateLogisticsFixedCost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const formData = new FormData(event.currentTarget);
      const response = await fetch(`${apiBaseUrl}/management/logistics-accounting/fixed-costs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(formData.get("name") ?? ""),
          category: String(formData.get("category") ?? ""),
          frequency: String(formData.get("frequency") ?? ""),
          amountAwg: Number(formData.get("amountAwg") ?? 0),
          startDate: String(formData.get("startDate") ?? ""),
          notes: String(formData.get("notes") ?? ""),
        }),
      });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setLogisticsAccountingStatuses((current) => ({
          ...current,
          fixedCosts: { tone: "error", message: data.message ?? "No fue posible guardar el costo fijo." },
        }));
        return;
      }

      setLogisticsAccountingModalKind(null);
      await refreshLogisticsAccountingData();
    } catch {
      setLogisticsAccountingStatuses((current) => ({
        ...current,
        fixedCosts: { tone: "error", message: "No fue posible conectar con el backend." },
      }));
    }
  }

  async function handleCreateLogisticsExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const formData = new FormData(event.currentTarget);
      const response = await fetch(`${apiBaseUrl}/management/logistics-accounting/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(formData.get("name") ?? ""),
          category: String(formData.get("category") ?? ""),
          amountAwg: Number(formData.get("amountAwg") ?? 0),
          expenseDate: String(formData.get("expenseDate") ?? ""),
          notes: String(formData.get("notes") ?? ""),
        }),
      });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setLogisticsAccountingStatuses((current) => ({
          ...current,
          expenses: { tone: "error", message: data.message ?? "No fue posible guardar el gasto." },
        }));
        return;
      }

      setLogisticsAccountingModalKind(null);
      await refreshLogisticsAccountingData();
    } catch {
      setLogisticsAccountingStatuses((current) => ({
        ...current,
        expenses: { tone: "error", message: "No fue posible conectar con el backend." },
      }));
    }
  }

  async function handleDeleteLogisticsInvoice(id: string) {
    if (!id) return;

    try {
      const response = await fetch(`${apiBaseUrl}/management/logistics-accounting/invoices/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        return;
      }

      await refreshLogisticsAccountingData();
    } catch {
      // silent fail
    }
  }

  async function handleRouteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const salesRep = salesRepOptions.find((option) => option.value === routeForm.salesRepId);
    const days = routeDayOptions
      .map((option) => ({
        day: option.key,
        stores: routeForm.dayAssignments[option.key]
          .map((storeId) => storeOptions.find((store) => store.value === storeId))
          .filter((store): store is StoreOption => Boolean(store))
          .map((store) => ({ storeId: store.value, storeName: store.label, address: store.address })),
      }))
      .filter((day) => day.stores.length > 0);

    if (!routeForm.name.trim() || !salesRep) {
      setRouteStatus({ tone: "error", message: "Completa el nombre y el vendedor antes de guardar." });
      return;
    }

    if (days.length === 0) {
      setRouteStatus({ tone: "error", message: "Asigna al menos una tienda en algun dia de la semana." });
      return;
    }

    try {
      setIsSavingRoute(true);
      const response = await fetch(`${apiBaseUrl}/management/routes${editingRouteId ? `/${editingRouteId}` : ""}`, {
        method: editingRouteId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: routeForm.name.trim(),
          salesRepId: salesRep.value,
          salesRepName: salesRep.label,
          weekStart: routeForm.weekStart,
          notes: routeForm.notes.trim(),
          days,
        }),
      });
      const data = (await response.json()) as SalesRouteRecord | { message?: string };

      if (!response.ok) {
        setRouteStatus({
          tone: "error",
          message: "message" in data ? data.message ?? "No fue posible guardar la ruta." : "No fue posible guardar la ruta.",
        });
        return;
      }

      setEditingRouteId("");
      setRouteForm((current) => ({
        ...createInitialRouteForm(),
        salesRepId: current.salesRepId,
      }));
      setRouteStatus({
        tone: "success",
        message: editingRouteId ? "Ruta actualizada correctamente." : "Ruta semanal creada correctamente.",
      });
      await Promise.all([refreshKpis(), refreshRoutesDatabase()]);
    } catch {
      setRouteStatus({ tone: "error", message: "No fue posible conectar con el backend." });
    } finally {
      setIsSavingRoute(false);
    }
  }

  async function handleCatalogSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setIsSavingCatalog(true);
      setCatalogStatus(null);
      const response = await fetch(`${apiBaseUrl}/management/catalogs${editingCatalogId ? `/${editingCatalogId}` : ""}`, {
        method: editingCatalogId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: catalogForm.name.trim(),
          description: catalogForm.description.trim(),
          categoryNames: catalogForm.categoryNames,
          productIds: catalogForm.productIds,
        }),
      });
      const data = (await response.json()) as CatalogRecord | { message?: string };

      if (!response.ok) {
        setCatalogStatus({
          tone: "error",
          message: "message" in data ? data.message ?? "No fue posible guardar el catalogo." : "No fue posible guardar el catalogo.",
        });
        return;
      }

      setCatalogStatus({
        tone: "success",
        message: editingCatalogId ? "Catalogo actualizado correctamente." : "Catalogo guardado correctamente.",
      });
      resetCatalogForm({ preserveStatus: true });
      await refreshCatalogs();
    } catch {
      setCatalogStatus({ tone: "error", message: "No fue posible conectar con el backend." });
    } finally {
      setIsSavingCatalog(false);
    }
  }

  async function handleDeleteCatalog(catalog: CatalogRecord) {
    const catalogId = typeof catalog._id === "string" ? catalog._id : "";

    if (!catalogId) {
      setCatalogStatus({ tone: "error", message: "No fue posible identificar el catalogo seleccionado." });
      return;
    }

    if (!globalThis.confirm(`Se borrara el catalogo ${catalog.name}.`)) {
      return;
    }

    try {
      setCatalogStatus(null);
      const response = await fetch(`${apiBaseUrl}/management/catalogs/${catalogId}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setCatalogStatus({ tone: "error", message: data.message ?? "No fue posible borrar el catalogo." });
        return;
      }

      if (editingCatalogId === catalogId) {
        resetCatalogForm();
      }

      if (selectedCatalogId === catalogId) {
        setSelectedCatalogId("");
        setCatalogPreviewItems([]);
      }

      setCatalogStatus({ tone: "success", message: "Catalogo borrado correctamente." });
      await refreshCatalogs();
    } catch {
      setCatalogStatus({ tone: "error", message: "No fue posible conectar con el backend." });
    }
  }

  async function handleCatalogPricingSubmit() {
    if (!selectedCatalogId) {
      setCatalogPricingStatus({ tone: "error", message: "Selecciona un catalogo antes de guardar precios." });
      return;
    }

    if (selectedCatalogClientIds.length === 0) {
      setCatalogPricingStatus({ tone: "error", message: "Agrega al menos un cliente antes de guardar el catalogo." });
      return;
    }

    if (catalogPreviewItems.length === 0) {
      setCatalogPricingStatus({ tone: "error", message: "El catalogo seleccionado no tiene productos para guardar." });
      return;
    }

    if (!selectedCatalogRecord) {
      setCatalogPricingStatus({ tone: "error", message: "Selecciona el catalogo que deseas guardar." });
      return;
    }

    try {
      setIsSavingCatalogPricing(true);
      setCatalogPricingStatus(null);
      await saveCatalogPricingForSelectedClients();
      await refreshCatalogs();
      setCatalogPricingStatus({
        tone: "success",
        message: `Catalogo guardado para ${selectedCatalogClientIds.length} cliente${selectedCatalogClientIds.length === 1 ? "" : "s"}. Este guardado alimenta los pedidos del portal de bodega.`,
      });
    } catch (error) {
      setCatalogPricingStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "No fue posible guardar el catalogo para pedidos.",
      });
    } finally {
      setIsSavingCatalogPricing(false);
    }
  }

  async function handleCatalogPdfDownload() {
    if (!selectedCatalogId) {
      setCatalogPricingStatus({ tone: "error", message: "Selecciona un catalogo antes de descargar el PDF." });
      return;
    }

    if (catalogPreviewItems.length === 0) {
      setCatalogPricingStatus({ tone: "error", message: "El catalogo seleccionado no tiene productos para generar el PDF." });
      return;
    }

    try {
      setCatalogPricingStatus(null);
      await generateCatalogPdf();
      setCatalogPricingStatus({
        tone: "success",
        message: "PDF del catalogo generado correctamente.",
      });
    } catch (error) {
      setCatalogPricingStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "No fue posible generar el PDF del catalogo.",
      });
    }
  }

  if (!sessionUser) {
    return (
      <main className="login-shell">
        <section className="login-panel">
          <img className="login-logo" src="/sps-logo.jpeg" alt="SPS Trading Enterprises" />
          <div>
            <p className="section-label">Comercio App</p>
            <h1>Iniciar sesion</h1>
            <p className="route-helper-text">Accede segun tu rol para administrar catalogos, rutas, inventario y pedidos.</p>
          </div>

          <form className="login-form" onSubmit={(event) => void handleLogin(event)}>
            <label className="field">
              <span>Correo</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="usuario@spste.com"
                autoComplete="email"
                required
              />
            </label>

            <label className="field">
              <span>Contrasena</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Ingresa tu contrasena"
                autoComplete="current-password"
                required
              />
            </label>

            {loginError ? <p className="form-feedback error">{loginError}</p> : null}

            <button className="submit-button" type="submit" disabled={isAuthenticating}>
              {isAuthenticating ? "Ingresando..." : "Entrar"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  if (sessionUser.role === "sales-rep-aruba") {
    return (
      <main className="portal-shell">
        <aside className="sidebar">
          <img className="sidebar-logo" src="/sps-logo.jpeg" alt="SPS Trading Enterprises" />

          <div className="sidebar-user">
            <p className="section-label">{userRoleLabel}</p>
            <h2>{sessionUser.name}</h2>
            <p>{sessionUser.email}</p>
          </div>

          <nav className="sidebar-nav">
            <button
              className={`sidebar-link ${sellerActiveSection === "routes" ? "active" : ""}`}
              type="button"
              onClick={() => setSellerActiveSection("routes")}
            >
              Rutas asignadas
            </button>
            <button
              className={`sidebar-link ${sellerActiveSection === "orders" ? "active" : ""}`}
              type="button"
              onClick={() => setSellerActiveSection("orders")}
            >
              Pedidos
            </button>
          </nav>

          <button className="ghost-button" type="button" onClick={handleLogout}>
            Cerrar sesion
          </button>
        </aside>

        <section className="portal-content">
          <header className="portal-header">
            <p className="section-label">Portal Vendedor</p>
            <h1>{sellerActiveSection === "orders" ? "Pedidos realizados" : "Rutas asignadas"}</h1>
            <p>
              {sellerActiveSection === "orders"
                ? "Consulta el historial de pedidos enviados desde tu portal y revisa su estado actual."
                : "Revisa las rutas creadas por gerencia, abre el dia de trabajo, selecciona el cliente y arma el pedido que recibira bodega para despacho."}
            </p>
          </header>

          {sellerActiveSection === "orders" ? (
            <section className="routes-layout">
              <article className="creation-selector-block">
                <p className="section-label">Historial</p>
                <h2>Pedidos realizados</h2>
                <p className="route-helper-text">Aqui veras los pedidos que ya enviaste a bodega desde tus rutas asignadas.</p>
              </article>

              <article className="database-card">
                <div className="management-table-header">
                  <div>
                    <h2>Pedidos enviados</h2>
                    <p>Consulta cliente, fecha, estado y detalle de productos por pedido.</p>
                  </div>
                  <p className="management-table-meta">{sellerOrders.length} pedidos</p>
                </div>

                {sellerOrdersError ? <p className="form-feedback error">{sellerOrdersError}</p> : null}

                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Cliente</th>
                        <th>Zona</th>
                        <th>Estado</th>
                        <th>Productos</th>
                        <th>Detalle</th>
                        <th>Accion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoadingSellerOrders ? (
                        <tr>
                          <td colSpan={7} className="empty-table-cell">Cargando pedidos realizados...</td>
                        </tr>
                      ) : sellerOrders.length > 0 ? (
                        sellerOrders.map((order) => {
                          const totalUnits = order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

                          return (
                            <tr key={order._id}>
                              <td>{formatSellerOrderDate(order.createdAt)}</td>
                              <td>{order.storeName}</td>
                              <td>{order.deliveryZone}</td>
                              <td>{formatSellerOrderStatus(order.status)}</td>
                              <td>{`${order.items.length} producto${order.items.length === 1 ? "" : "s"} / ${totalUnits} und`}</td>
                              <td>
                                {order.items.length > 0 ? (
                                  <button
                                    className="seller-order-detail-trigger"
                                    type="button"
                                    onClick={() => setSelectedSellerOrderDetail(order)}
                                  >
                                    Ver mas
                                  </button>
                                ) : "-"}
                              </td>
                              <td>
                                <div className="table-action-group">
                                  <button
                                    className="table-action-icon"
                                    type="button"
                                    aria-label="Modificar pedido"
                                    title="Modificar"
                                    onClick={() => openSellerOrderEdit(order)}
                                  >
                                    <svg viewBox="0 0 24 24" aria-hidden="true">
                                      <path d="M4 20h4l10-10-4-4L4 16v4zm12.7-12.3 1.6-1.6a1 1 0 0 1 1.4 0l1.2 1.2a1 1 0 0 1 0 1.4L19.3 10l-2.6-2.3z" fill="currentColor" />
                                    </svg>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={7} className="empty-table-cell">Todavia no has realizado pedidos desde tu portal.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </article>

              {selectedSellerOrderDetail ? (
                <div className="modal-overlay" role="presentation" onClick={() => setSelectedSellerOrderDetail(null)}>
                  <div className="modal-card seller-order-detail-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
                    <div className="modal-header">
                      <div>
                        <p className="section-label">Pedido enviado</p>
                        <h2>{selectedSellerOrderDetail.storeName}</h2>
                        <p>{formatSellerOrderDate(selectedSellerOrderDetail.createdAt)} · {formatSellerOrderStatus(selectedSellerOrderDetail.status)}</p>
                      </div>
                      <button className="modal-close-button" type="button" onClick={() => setSelectedSellerOrderDetail(null)}>Cerrar</button>
                    </div>

                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>SKU</th>
                            <th>Producto</th>
                            <th>Stock actual</th>
                            <th>Cantidad</th>
                            <th>Notas</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedSellerOrderDetail.items.map((item) => (
                            <tr key={`${selectedSellerOrderDetail._id}-${item.productId}`}>
                              <td>{item.productSku}</td>
                              <td>{item.productName}</td>
                              <td>{item.stockCurrent ?? "-"}</td>
                              <td>{item.quantity}</td>
                              <td>{item.notes || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : null}

              {selectedSellerOrderEdit ? (
                <div className="modal-overlay" role="presentation" onClick={() => setSelectedSellerOrderEdit(null)}>
                  <div className="modal-card seller-order-detail-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
                    <div className="modal-header">
                      <div>
                        <p className="section-label">Modificar pedido</p>
                        <h2>{selectedSellerOrderEdit.storeName}</h2>
                        <p>Solo puedes editar la cantidad durante las primeras 6 horas despues de crear el pedido.</p>
                      </div>
                      <button className="modal-close-button" type="button" onClick={() => setSelectedSellerOrderEdit(null)}>Cerrar</button>
                    </div>

                    {sellerOrderEditStatus ? <p className={`form-feedback ${sellerOrderEditStatus.tone}`}>{sellerOrderEditStatus.message}</p> : null}

                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>SKU</th>
                            <th>Producto</th>
                            <th>Stock actual</th>
                            <th>Cantidad</th>
                            <th>Notas</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedSellerOrderEdit.items.map((item) => (
                            <tr key={`${selectedSellerOrderEdit._id}-${item.productId}`}>
                              <td>{item.productSku}</td>
                              <td>{item.productName}</td>
                              <td>{item.stockCurrent ?? "-"}</td>
                              <td>
                                <input
                                  className="catalog-price-input seller-order-input"
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={sellerOrderEditDraft[item.productId] ?? String(item.quantity)}
                                  onChange={(event) => setSellerOrderEditDraft((current) => ({
                                    ...current,
                                    [item.productId]: event.target.value,
                                  }))}
                                />
                              </td>
                              <td>{item.notes || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="seller-order-footer">
                      <p>Las cantidades modificadas reemplazaran el pedido original.</p>
                      <button className="submit-button seller-order-submit" type="button" onClick={() => void handleSellerOrderEditSubmit()} disabled={isSavingSellerOrderEdit}>
                        {isSavingSellerOrderEdit ? "Guardando cambios..." : "Guardar cambios"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {sellerOrderExpiredNotice ? (
                <div className="modal-overlay" role="presentation" onClick={() => setSellerOrderExpiredNotice(null)}>
                  <div className="modal-card seller-order-expired-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
                    <div className="modal-header">
                      <div>
                        <p className="section-label">Edicion no disponible</p>
                        <h2>El tiempo para modificar el pedido ha caducado</h2>
                        <p>{sellerOrderExpiredNotice.storeName} · {formatSellerOrderDate(sellerOrderExpiredNotice.createdAt)}</p>
                      </div>
                      <button className="modal-close-button" type="button" onClick={() => setSellerOrderExpiredNotice(null)}>Cerrar</button>
                    </div>

                    <p className="route-helper-text">Solo se permiten cambios durante las primeras 6 horas despues de crear el pedido. Si necesitas ajustarlo despues de ese tiempo, debe intervenir gerencia o bodega.</p>
                  </div>
                </div>
              ) : null}
            </section>
          ) : (
            <section className="routes-layout">
              <article className="creation-selector-block">
                <p className="section-label">Tu agenda</p>
                <h2>Rutas asignadas por gerencia</h2>
                <p className="route-helper-text">Aqui solo veras las rutas asociadas a tu usuario y podras preparar el pedido de cada cliente visitado.</p>
              </article>

              <article className="database-card">
                <div className="management-table-header">
                  <div>
                    <h2>Mis rutas</h2>
                    <p>Selecciona una ruta para abrir sus dias y clientes asignados.</p>
                  </div>
                  <p className="management-table-meta">{sellerRoutes.length} rutas</p>
                </div>

                {sellerRoutesError ? <p className="form-feedback error">{sellerRoutesError}</p> : null}

                <div className="seller-route-list">
                  {isLoadingSellerRoutes ? (
                    <article className="route-summary-card is-loading" />
                  ) : sellerRoutes.length > 0 ? (
                    sellerRoutes.map((route) => {
                      const routeKey = route._id ?? route.code;
                      const isSelected = routeKey === selectedSellerRouteId;

                      return (
                        <button
                          key={routeKey}
                          className={`seller-route-list-item ${isSelected ? "is-active" : ""}`}
                          type="button"
                          onClick={() => setSelectedSellerRouteId(routeKey)}
                        >
                          <div>
                            <p className="section-label">{route.weekLabel}</p>
                            <strong>{route.name}</strong>
                            <span>{route.days.length} dias planeados</span>
                          </div>
                          <span>{route.plannedStops} tiendas</span>
                        </button>
                      );
                    })
                  ) : (
                    <p className="route-empty-state">Aun no tienes rutas asignadas.</p>
                  )}
                </div>
              </article>

              {selectedSellerRoute ? (
                <article className="route-builder-card seller-route-workspace">
                  <div className="management-table-header">
                    <div>
                      <p className="section-label">Ruta activa</p>
                      <h2>{selectedSellerRoute.name}</h2>
                      <p>{selectedSellerRoute.weekLabel} · {selectedSellerRoute.salesRepName}</p>
                    </div>
                    <p className="management-table-meta">{selectedSellerRoute.plannedStops} tiendas</p>
                  </div>

                  <div className="seller-route-day-tabs">
                    {selectedSellerRoute.days.map((day) => (
                      <button
                        key={`${selectedSellerRoute._id ?? selectedSellerRoute.code}-${day.day}`}
                        className={`seller-route-day-button ${selectedSellerDayKey === day.day ? "is-active" : ""}`}
                        type="button"
                        onClick={() => setSelectedSellerDayKey(day.day)}
                      >
                        <strong>{formatRouteDayLabel(day.day)}</strong>
                        <span>{day.stores.length} clientes</span>
                      </button>
                    ))}
                  </div>

                  {selectedSellerDay ? (
                    <>
                      <div className="seller-route-client-panel">
                        <div className="field field-full">
                          <span>Cliente de la ruta</span>
                          <div className="seller-route-store-chips">
                            {selectedSellerStores.map((store) => {
                              const isActive = selectedSellerStoreId === store.storeId;
                              const isVisited = visitedSellerStoreIds.has(store.storeId);

                              return (
                                <button
                                  key={store.storeId}
                                  className={`seller-route-store-chip ${isActive ? "is-active" : ""} ${isVisited ? "is-visited" : ""}`}
                                  type="button"
                                  onClick={() => setSelectedSellerStoreId(store.storeId)}
                                >
                                  {store.storeName}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {selectedSellerStore ? (
                          <p className="warehouse-selected-meta">{selectedSellerStore.storeName} · {selectedSellerStore.address || "Sin direccion"}</p>
                        ) : null}
                      </div>

                      {sellerClientProductsError ? <p className="form-feedback error">{sellerClientProductsError}</p> : null}
                      {sellerOrderStatus ? <p className={`form-feedback ${sellerOrderStatus.tone}`}>{sellerOrderStatus.message}</p> : null}

                      <div className="table-wrap">
                        <table className="data-table seller-products-table">
                          <thead>
                            <tr>
                              <th>Imagen</th>
                              <th>SKU</th>
                              <th>Producto</th>
                              <th>Categoria</th>
                              <th>Stock actual</th>
                              <th>Cantidad</th>
                              <th>Notas</th>
                            </tr>
                          </thead>
                          <tbody>
                            {isLoadingSellerClientProducts ? (
                              <tr>
                                <td colSpan={7} className="empty-table-cell">Cargando productos asignados al cliente...</td>
                              </tr>
                            ) : sellerClientProducts.length > 0 ? (
                              sellerClientProducts.map((product) => {
                                  const draft = sellerOrderDraft[product.productId] ?? { stockCurrent: "", quantity: "", notes: "" };

                                return (
                                  <tr key={product.productId}>
                                    <td>
                                      {product.imageUrl ? (
                                        <img className="seller-product-thumb" src={product.imageUrl} alt={product.name} />
                                      ) : (
                                        <div className="seller-product-thumb seller-product-thumb-placeholder">SIN IMAGEN</div>
                                      )}
                                    </td>
                                    <td>{product.sku}</td>
                                    <td>{product.name}</td>
                                    <td>{product.category || "-"}</td>
                                    <td>
                                      <input
                                        className="catalog-price-input seller-order-input"
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={draft.stockCurrent}
                                        placeholder="0"
                                        onChange={(event) => handleSellerOrderDraftChange(product.productId, "stockCurrent", event.target.value)}
                                      />
                                    </td>
                                    <td>
                                      <input
                                        className="catalog-price-input seller-order-input"
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={draft.quantity}
                                        placeholder="0"
                                        onChange={(event) => handleSellerOrderDraftChange(product.productId, "quantity", event.target.value)}
                                      />
                                    </td>
                                    <td>
                                      <input
                                        className="seller-order-note-input"
                                        type="text"
                                        value={draft.notes}
                                        placeholder="Observacion para bodega"
                                        onChange={(event) => handleSellerOrderDraftChange(product.productId, "notes", event.target.value)}
                                      />
                                    </td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr>
                                <td colSpan={7} className="empty-table-cell">Este cliente aun no tiene productos asignados por gerencia.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      <div className="seller-order-footer">
                        <p>{sellerDraftedItems.length > 0 ? `${sellerDraftedItems.length} producto${sellerDraftedItems.length === 1 ? "" : "s"} listos para registrar.` : "Todavia no has agregado stock actual o cantidades al pedido."}</p>
                        <button
                          className="submit-button seller-order-submit"
                          type="button"
                          onClick={() => void handleSellerOrderSubmit()}
                          disabled={isSubmittingSellerOrder || isLoadingSellerClientProducts || sellerClientProducts.length === 0}
                        >
                          {isSubmittingSellerOrder ? "Enviando pedido a bodega..." : "Enviar pedido a bodega"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="route-empty-state">Selecciona un dia de la ruta para trabajar su pedido.</p>
                  )}
                </article>
              ) : null}
            </section>
          )}
        </section>
      </main>
    );
  }

  if (sessionUser.role === "warehouse-aruba") {
    return (
      <main className="portal-shell">
        <aside className="sidebar">
          <img className="sidebar-logo" src="/sps-logo.jpeg" alt="SPS Trading Enterprises" />

          <div className="sidebar-user">
            <p className="section-label">{userRoleLabel}</p>
            <h2>{sessionUser.name}</h2>
            <p>{sessionUser.email}</p>
          </div>

          <nav className="sidebar-nav">
            <button
              className={`sidebar-link ${warehouseActiveSection === "inventory" ? "active" : ""}`}
              type="button"
              onClick={() => {
                setWarehouseActiveSection("inventory");
                setSelectedWarehouseOrderDetail(null);
                setWarehouseOrderCompletionStatus(null);
              }}
            >
              Inventario
            </button>
            <button
              className={`sidebar-link ${warehouseActiveSection === "orders" ? "active" : ""}`}
              type="button"
              onClick={() => setWarehouseActiveSection("orders")}
            >
              Pedidos
            </button>
          </nav>

          <button className="ghost-button" type="button" onClick={handleLogout}>
            Cerrar sesion
          </button>
        </aside>

        <section className="portal-content">
          <header className="portal-header">
            <p className="section-label">Portal Bodega</p>
            <h1>{warehouseActiveSection === "orders" ? "Pedidos recibidos" : "Inventario"}</h1>
            <p>
              {warehouseActiveSection === "orders"
                ? "Recibe los pedidos enviados por los vendedores y consulta su detalle operativo."
                : "Consulta el inventario actual y registra salidas cuando sea necesario desde bodega."}
            </p>
          </header>

          {warehouseActiveSection === "orders" ? (
            <section className="routes-layout">
              {selectedWarehouseOrderDetail ? (
                <>
                  <article className="creation-selector-block">
                    <p className="section-label">Pedido recibido</p>
                    <h2>{selectedWarehouseOrderDetail.storeName}</h2>
                    <p className="route-helper-text">
                      {selectedWarehouseOrderDetail.salesRepName} · {formatSellerOrderDate(selectedWarehouseOrderDetail.createdAt)}
                    </p>
                    <button className="ghost-button" type="button" onClick={() => {
                      setSelectedWarehouseOrderDetail(null);
                      setWarehouseOrderCompletionStatus(null);
                    }}>
                      Volver a pedidos
                    </button>
                  </article>

                  <article className="database-card">
                    <div className="management-table-header">
                      <div>
                        <h2>Detalle del pedido</h2>
                        <p>{`${selectedWarehouseOrderDetail.routeName} · ${formatRouteDayLabel(selectedWarehouseOrderDetail.routeDay as RouteDayKey)}`}</p>
                      </div>
                      <p className="management-table-meta">
                        {selectedWarehouseOrderDetail.items.length} producto{selectedWarehouseOrderDetail.items.length === 1 ? "" : "s"}
                      </p>
                    </div>

                    <div className="warehouse-order-detail-grid">
                      <div className="warehouse-order-summary-card">
                        <p className="section-label">Checklist</p>
                        <strong>{warehouseAllItemsChecked ? "Listo para facturar" : "Pendiente de revision"}</strong>
                        <p>
                          Marca cada producto preparado antes de completar el pedido.
                        </p>
                      </div>

                      <div className="warehouse-order-summary-card">
                        <p className="section-label">Catalogo</p>
                        <label className="field warehouse-order-catalog-field">
                          <span>Selecciona un catalogo</span>
                          <select
                            value={selectedCatalogId}
                            onChange={(event) => setSelectedCatalogId(event.target.value)}
                            disabled={isLoadingCatalogs || orderReadyCatalogs.length === 0}
                          >
                            <option value="">Selecciona un catalogo guardado</option>
                            {orderReadyCatalogs.map((catalog) => (
                              <option key={catalog._id ?? catalog.code} value={catalog._id}>{catalog.name}</option>
                            ))}
                          </select>
                        </label>
                        <p>
                          {orderReadyCatalogs.length === 0
                            ? "Todavia no hay catalogos guardados para pedidos desde gerencia."
                            : warehouseOrderClient
                            ? `Cliente del pedido: ${warehouseOrderClient.label}`
                            : `Cliente del pedido: ${selectedWarehouseOrderDetail.storeName}`}
                        </p>
                      </div>

                      <div className="warehouse-order-summary-card">
                        <p className="section-label">Factura</p>
                        <strong>{formatCurrency(warehouseInvoiceTotal)}</strong>
                        <p>
                          {warehouseFallbackPriceCount > 0
                            ? `${warehouseFallbackPriceCount} producto${warehouseFallbackPriceCount === 1 ? " usa" : "s usan"} precio base del producto fuera del catalogo.`
                            : "Todos los productos tienen precio resuelto desde el catalogo seleccionado."}
                        </p>
                      </div>
                    </div>

                    {catalogError ? <p className="form-feedback error">{catalogError}</p> : null}
                    {catalogPreviewError ? <p className="form-feedback error">{catalogPreviewError}</p> : null}
                    {warehouseOrderCompletionStatus ? (
                      <p className={`form-feedback ${warehouseOrderCompletionStatus.tone === "error" ? "error" : "success"}`}>
                        {warehouseOrderCompletionStatus.message}
                      </p>
                    ) : null}

                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Check</th>
                            <th>SKU</th>
                            <th>Producto</th>
                            <th>Stock actual</th>
                            <th>Cantidad</th>
                            <th>Precio</th>
                            <th>Total</th>
                            <th>Notas</th>
                          </tr>
                        </thead>
                        <tbody>
                          {warehousePricedItems.map((item) => (
                            <tr key={`${selectedWarehouseOrderDetail._id}-${item.productId}`}>
                              <td className="warehouse-order-check-cell">
                                <input
                                  className="warehouse-order-check"
                                  type="checkbox"
                                  checked={Boolean(warehouseOrderChecklist[item.productId])}
                                  disabled={selectedWarehouseOrderDetail.status === "delivered"}
                                  onChange={(event) =>
                                    setWarehouseOrderChecklist((current) => ({
                                      ...current,
                                      [item.productId]: event.target.checked,
                                    }))
                                  }
                                />
                              </td>
                              <td>{item.productSku}</td>
                              <td>{item.productName}</td>
                              <td>{item.stockCurrent ?? "-"}</td>
                              <td>{item.quantity}</td>
                              <td>{formatCurrency(item.resolvedSalePrice)}</td>
                              <td>{formatCurrency(item.lineTotal)}</td>
                              <td>{item.notes || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="warehouse-order-toolbar">
                      <p>
                        Estado actual: <strong>{formatSellerOrderStatus(selectedWarehouseOrderDetail.status)}</strong>
                      </p>
                      <button
                        className="submit-button seller-order-submit"
                        type="button"
                        disabled={
                          isCompletingWarehouseOrder
                          || isLoadingCatalogPreview
                          || !selectedCatalogId
                          || warehousePricedItems.length === 0
                          || !warehouseAllItemsChecked
                          || selectedWarehouseOrderDetail.status === "delivered"
                        }
                        onClick={handleWarehouseOrderComplete}
                      >
                        {isCompletingWarehouseOrder ? "Generando factura..." : selectedWarehouseOrderDetail.status === "delivered" ? "Pedido completado" : "Completar pedido y generar factura"}
                      </button>
                    </div>
                  </article>
                </>
              ) : (
                <>
                  <article className="creation-selector-block">
                    <p className="section-label">Recepcion</p>
                    <h2>Pedidos del equipo comercial</h2>
                    <p className="route-helper-text">Aqui llegan los pedidos creados por los vendedores para preparacion y despacho desde bodega.</p>
                  </article>

                  <article className="database-card">
                    <div className="management-table-header">
                      <div>
                        <h2>Pedidos recibidos</h2>
                        <p>Consulta vendedor, cliente, ruta, fecha y detalle de productos por pedido.</p>
                      </div>
                      <p className="management-table-meta">{warehouseReceivedOrders.length} pedidos</p>
                    </div>

                    {warehouseOrdersError ? <p className="form-feedback error">{warehouseOrdersError}</p> : null}

                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th>Vendedor</th>
                            <th>Cliente</th>
                            <th>Ruta</th>
                            <th>Estado</th>
                            <th>Productos</th>
                            <th>Detalle</th>
                          </tr>
                        </thead>
                        <tbody>
                          {isLoadingWarehouseOrders ? (
                            <tr>
                              <td colSpan={7} className="empty-table-cell">Cargando pedidos recibidos...</td>
                            </tr>
                          ) : warehouseReceivedOrders.length > 0 ? (
                            warehouseReceivedOrders.map((order) => {
                              const totalUnits = order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

                              return (
                                <tr key={order._id}>
                                  <td>{formatSellerOrderDate(order.createdAt)}</td>
                                  <td>{order.salesRepName}</td>
                                  <td>{order.storeName}</td>
                                  <td>{`${order.routeName} · ${formatRouteDayLabel(order.routeDay as RouteDayKey)}`}</td>
                                  <td>{formatSellerOrderStatus(order.status)}</td>
                                  <td>{`${order.items.length} producto${order.items.length === 1 ? "" : "s"} / ${totalUnits} und`}</td>
                                  <td>
                                    {order.items.length > 0 ? (
                                      <button
                                        className="seller-order-detail-trigger"
                                        type="button"
                                        onClick={() => setSelectedWarehouseOrderDetail(order)}
                                      >
                                        Ver mas
                                      </button>
                                    ) : "-"}
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={7} className="empty-table-cell">No hay pedidos pendientes por procesar.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </article>

                  <article className="database-card">
                    <div className="management-table-header">
                      <div>
                        <h2>Pedidos completados</h2>
                        <p>Aqui se muestran los pedidos ya entregados y cerrados en bodega.</p>
                      </div>
                      <p className="management-table-meta">{warehouseCompletedOrders.length} pedidos</p>
                    </div>

                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th>Vendedor</th>
                            <th>Cliente</th>
                            <th>Ruta</th>
                            <th>Estado</th>
                            <th>Productos</th>
                            <th>Detalle</th>
                          </tr>
                        </thead>
                        <tbody>
                          {isLoadingWarehouseOrders ? (
                            <tr>
                              <td colSpan={7} className="empty-table-cell">Cargando pedidos completados...</td>
                            </tr>
                          ) : warehouseCompletedOrders.length > 0 ? (
                            warehouseCompletedOrders.map((order) => {
                              const totalUnits = order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

                              return (
                                <tr key={order._id}>
                                  <td>{formatSellerOrderDate(order.createdAt)}</td>
                                  <td>{order.salesRepName}</td>
                                  <td>{order.storeName}</td>
                                  <td>{`${order.routeName} · ${formatRouteDayLabel(order.routeDay as RouteDayKey)}`}</td>
                                  <td>{formatSellerOrderStatus(order.status)}</td>
                                  <td>{`${order.items.length} producto${order.items.length === 1 ? "" : "s"} / ${totalUnits} und`}</td>
                                  <td>
                                    {order.items.length > 0 ? (
                                      <button
                                        className="seller-order-detail-trigger"
                                        type="button"
                                        onClick={() => setSelectedWarehouseOrderDetail(order)}
                                      >
                                        Ver mas
                                      </button>
                                    ) : "-"}
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={7} className="empty-table-cell">Todavia no hay pedidos completados.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </article>
                </>
              )}
            </section>
          ) : (
            <section className="database-layout">
              <div className="accounting-kpi-grid">
                {isLoadingInventory
                  ? Array.from({ length: 4 }, (_, index) => <article key={index} className="kpi-card is-loading" />)
                  : (
                    <>
                      <article className="kpi-card tone-cyan">
                        <p>Productos en inventario</p>
                        <strong>{inventoryKpis.totalProducts}</strong>
                      </article>
                      <article className="kpi-card tone-amber">
                        <p>Unidades disponibles</p>
                        <strong>{inventoryKpis.totalUnits}</strong>
                      </article>
                      <article className="kpi-card tone-slate">
                        <p>Costo total inventario (AWG)</p>
                        <strong>{formatAwgCurrency(inventoryKpis.totalInventoryCost)}</strong>
                      </article>
                      <button
                        className={`kpi-card kpi-card-button tone-cyan ${inventoryFilter === "expiring-soon" ? "is-active" : ""}`}
                        type="button"
                        onClick={toggleExpiringSoonInventoryFilter}
                      >
                        <p>Prontos a vencerse (2 meses)</p>
                        <strong>{inventoryKpis.expiringSoon}</strong>
                      </button>
                    </>
                  )}
              </div>

              {inventoryError ? <p className="form-feedback error">{inventoryError}</p> : null}

              <article className="database-card">
                <div className="creation-header database-header">
                  <div>
                    <h2>Inventario actual</h2>
                    <p>Resumen por producto con cantidades, costo, venta potencial y fecha de caducidad.</p>
                  </div>
                  <div className="inventory-header-actions">
                    <p className="management-table-meta">
                      {inventoryFilter === "expiring-soon"
                        ? `${filteredInventoryRows.length} proximos a vencer`
                        : `${filteredInventoryRows.length} resultados`}
                    </p>
                    <button className="primary-action-button" type="button" onClick={openInventoryEntryModal}>
                      Registrar inventario
                    </button>
                  </div>
                </div>

                {inventoryFilter === "expiring-soon" ? (
                  <p className="form-feedback success">
                    Mostrando solo productos proximos a vencer. Presiona el card nuevamente para ver todo el inventario.
                  </p>
                ) : null}

                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>Cantidad</th>
                        <th>Costo unitario (AWG)</th>
                        <th>Costo total (AWG)</th>
                        <th>Venta (AWG)</th>
                        <th>Total venta (AWG)</th>
                        <th>Fecha de caducidad</th>
                        <th>Accion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoadingInventory ? (
                        <tr>
                          <td colSpan={8} className="empty-table-cell">Cargando inventario...</td>
                        </tr>
                      ) : filteredInventoryRows.length > 0 ? (
                        filteredInventoryRows.map((row) => (
                          <tr key={row.productId}>
                            <td>{`${row.name} (${row.sku})`}</td>
                            <td>{row.quantity}</td>
                            <td>{formatCurrencyUpTwoDecimals(row.unitCost)}</td>
                            <td>{formatCurrencyUpTwoDecimals(row.totalCost)}</td>
                            <td>{formatCurrencyUpTwoDecimals(row.salePrice)}</td>
                            <td>{formatCurrencyUpTwoDecimals(row.totalSale)}</td>
                            <td>{row.expirationDate ? String(row.expirationDate).slice(0, 10) : "-"}</td>
                            <td>
                              <div className="table-action-group">
                                <button
                                  className="table-action-icon"
                                  type="button"
                                  aria-label="Sacar unidades del inventario"
                                  title="Sacar unidades"
                                  onClick={() => openInventoryAdjustmentModal(row)}
                                  disabled={row.quantity <= 0}
                                >
                                  <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="M4 20h4l10-10-4-4L4 16v4zm12.7-12.3 1.6-1.6a1 1 0 0 1 1.4 0l1.2 1.2a1 1 0 0 1 0 1.4L19.3 10l-2.6-2.3z" fill="currentColor" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={8} className="empty-table-cell">
                            {inventoryFilter === "expiring-soon"
                              ? "No hay productos proximos a vencer dentro de los proximos 2 meses."
                              : "Aun no hay inventario registrado."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </article>

              {selectedInventoryAdjustmentRow ? (
                <div className="modal-overlay" role="presentation" onClick={closeInventoryAdjustmentModal}>
                  <div className="modal-card inventory-adjustment-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
                    <div className="modal-header">
                      <div>
                        <p className="section-label">Salida de inventario</p>
                        <h2>{`${selectedInventoryAdjustmentRow.name} (${selectedInventoryAdjustmentRow.sku})`}</h2>
                        <p>Registra cuantas unidades van a salir del inventario y el motivo de la salida.</p>
                      </div>
                      <button className="modal-close-button" type="button" onClick={closeInventoryAdjustmentModal}>Cerrar</button>
                    </div>

                    <div className="inventory-cost-summary-grid inventory-adjustment-summary-grid">
                      <div className="import-summary-card">
                        <p>Unidades disponibles</p>
                        <strong>{selectedInventoryAdjustmentRow.quantity}</strong>
                      </div>
                      <div className="import-summary-card">
                        <p>Fecha de caducidad</p>
                        <strong>{selectedInventoryAdjustmentRow.expirationDate ? String(selectedInventoryAdjustmentRow.expirationDate).slice(0, 10) : "-"}</strong>
                      </div>
                    </div>

                    <form className="inventory-adjustment-form" onSubmit={handleInventoryAdjustmentSubmit}>
                      <div className="inventory-adjustment-grid">
                        <label className="field">
                          <span>Cantidad a sacar</span>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={inventoryAdjustmentForm.quantity}
                            placeholder="10"
                            onChange={(event) =>
                              setInventoryAdjustmentForm((current) => ({ ...current, quantity: event.target.value }))
                            }
                          />
                        </label>

                        <label className="field">
                          <span>Motivo</span>
                          <select
                            value={inventoryAdjustmentForm.reason}
                            onChange={(event) =>
                              setInventoryAdjustmentForm((current) => ({ ...current, reason: event.target.value }))
                            }
                          >
                            <option value="">Selecciona un motivo</option>
                            {inventoryAdjustmentReasonOptions.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </label>

                        <label className="field inventory-adjustment-notes">
                          <span>Detalle adicional</span>
                          <textarea
                            rows={4}
                            value={inventoryAdjustmentForm.notes}
                            placeholder="Ejemplo: 12 unidades vencidas detectadas en inspeccion interna."
                            onChange={(event) =>
                              setInventoryAdjustmentForm((current) => ({ ...current, notes: event.target.value }))
                            }
                          />
                        </label>
                      </div>

                      {inventoryAdjustmentStatus ? <p className={`form-feedback ${inventoryAdjustmentStatus.tone}`}>{inventoryAdjustmentStatus.message}</p> : null}

                      <button className="submit-button" type="submit" disabled={isSavingInventoryAdjustment}>
                        {isSavingInventoryAdjustment ? "Guardando salida..." : "Guardar salida del inventario"}
                      </button>
                    </form>
                  </div>
                </div>
              ) : null}

              {isInventoryEntryModalOpen ? (
                <div className="modal-overlay" role="presentation" onClick={closeInventoryEntryModal}>
                  <div className="modal-card inventory-entry-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
                    <div className="modal-header">
                      <div>
                        <p className="section-label">Entrada de inventario</p>
                        <h2>Registrar inventario</h2>
                        <p>Selecciona los productos que ingresan, define la tasa USD@AWG y revisa el costo convertido en florines.</p>
                      </div>
                      <button className="modal-close-button" type="button" onClick={closeInventoryEntryModal}>Cerrar</button>
                    </div>

                    <form className="inventory-adjustment-form" onSubmit={handleInventoryEntrySubmit}>
                      <div className="inventory-entry-top-grid">
                        <label className="field field-full">
                          <span>Bodega</span>
                          <select
                            value={inventoryEntryWarehouseId}
                            onChange={(event) => setInventoryEntryWarehouseId(event.target.value)}
                            disabled={warehouseOptions.length === 0}
                          >
                            <option value="">Selecciona una bodega</option>
                            {warehouseOptions.map((warehouse) => (
                              <option key={warehouse.value} value={warehouse.value}>{warehouse.label}</option>
                            ))}
                          </select>
                        </label>

                        <label className="field field-full">
                          <span>USD@AWG</span>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={inventoryUsdToAwgRate}
                            placeholder="1.79"
                            onChange={(event) => setInventoryUsdToAwgRate(event.target.value)}
                          />
                        </label>
                      </div>

                      <div className="inventory-entry-products">
                        {inventoryEntryItems.map((item, index) => (
                          <article key={item.id} className="inventory-entry-row">
                            <label className="field field-full">
                              <span>{`Producto ${index + 1}`}</span>
                              <select
                                value={item.productId}
                                onChange={(event) => updateInventoryEntryRow(item.id, "productId", event.target.value)}
                              >
                                <option value="">Selecciona un producto</option>
                                {productOptions.map((product) => (
                                  <option key={product.value} value={product.value}>{`${product.label} (${product.sku})`}</option>
                                ))}
                              </select>
                            </label>

                            <label className="field field-full">
                              <span>Cantidad</span>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={item.quantity}
                                placeholder="0"
                                onChange={(event) => updateInventoryEntryRow(item.id, "quantity", event.target.value)}
                              />
                            </label>

                            <label className="field field-full">
                              <span>Costo USD total del lote</span>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={item.costUsd}
                                placeholder="0.00"
                                onChange={(event) => updateInventoryEntryRow(item.id, "costUsd", event.target.value)}
                              />
                            </label>

                            <label className="field field-full">
                              <span>Venta AWG por unidad</span>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={item.salePriceAwg}
                                placeholder="0.00"
                                onChange={(event) => updateInventoryEntryRow(item.id, "salePriceAwg", event.target.value)}
                              />
                            </label>

                            <label className="field field-full">
                              <span>Peso por unidad (kg)</span>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={item.productWeightKg}
                                placeholder="0.00"
                                onChange={(event) => updateInventoryEntryRow(item.id, "productWeightKg", event.target.value)}
                              />
                            </label>

                            <label className="field field-full">
                              <span>Fecha de caducidad</span>
                              <input
                                type="date"
                                value={item.expirationDate}
                                onChange={(event) => updateInventoryEntryRow(item.id, "expirationDate", event.target.value)}
                              />
                            </label>

                            <label className="field field-full">
                              <span>Costo AWG total (calculado)</span>
                              <input type="number" readOnly value={getInventoryEntryCostAwg(item.costUsd)} placeholder="0.00" />
                            </label>

                            <button
                              className="ghost-button inventory-entry-remove"
                              type="button"
                              onClick={() => removeInventoryEntryRow(item.id)}
                              disabled={inventoryEntryItems.length <= 1}
                            >
                              Quitar
                            </button>
                          </article>
                        ))}
                      </div>

                      <div className="catalog-form-actions inventory-adjustment-actions">
                        <button className="ghost-button" type="button" onClick={addInventoryEntryRow}>
                          Agregar producto
                        </button>
                      </div>

                      {inventoryEntryStatus ? <p className={`form-feedback ${inventoryEntryStatus.tone}`}>{inventoryEntryStatus.message}</p> : null}

                      <button className="submit-button" type="submit" disabled={isSavingInventoryEntry}>
                        {isSavingInventoryEntry ? "Registrando inventario..." : "Guardar entrada de inventario"}
                      </button>
                    </form>
                  </div>
                </div>
              ) : null}
            </section>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="portal-shell">
      <aside className="sidebar">
        <img className="sidebar-logo" src="/sps-logo.jpeg" alt="SPS Trading Enterprises" />

        <div className="sidebar-user">
          <p className="section-label">{userRoleLabel}</p>
          <h2>{sessionUser.name}</h2>
          <p>{sessionUser.email}</p>
        </div>

        <nav className="sidebar-nav">
          {sessionUser.role === "management"
            ? (
                <>
                  <button
                    className={`sidebar-link ${activeSection === "dashboard" ? "active" : ""}`}
                    type="button"
                    onClick={() => setActiveSection("dashboard")}
                  >
                    Dashboard
                  </button>

                  {managementSidebarSections.map((section) => (
                    <div key={section.key}>
                      <p className="section-label">{section.label}</p>
                      {section.items.map((item) => (
                        <button
                          key={item.key}
                          className={`sidebar-link ${activeSection === item.key ? "active" : ""}`}
                          type="button"
                          onClick={() => setActiveSection(item.key)}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  ))}
                </>
              )
            : sidebarItems.map((item) => (
                <button
                  key={item.key}
                  className={`sidebar-link ${activeSection === item.key ? "active" : ""}`}
                  type="button"
                  onClick={() => setActiveSection(item.key)}
                >
                  {item.label}
                </button>
              ))}
        </nav>

        <button className="ghost-button" type="button" onClick={handleLogout}>
          Cerrar sesion
        </button>
      </aside>

      <section className="portal-content">
        <header className="portal-header">
          <p className="section-label">{`Portal ${userRoleLabel}`}</p>
          <h1>
            {activeSection === "dashboard"
              ? "Dashboard"
              : activeSection === "inventory"
                ? "Inventario"
                : activeSection === "inventory-entry"
                  ? "Registrar inventario"
              : activeSection === "orders"
                ? "Pedidos"
              : activeSection === "catalog"
                ? "Catalogo"
              : activeSection === "imports"
                ? "Exportaciones"
                : activeSection === "import-billing"
                  ? "Facturacion"
              : activeSection === "accounting"
                ? "Contabilidad"
              : activeSection === "logistics-accounting"
                ? "Contabilidad Logistica"
              : activeSection === "warehouses"
                ? "Bodegas"
              : isCreationSection
                ? selectedCollection.title
                : activeSection === "routes"
                  ? "Rutas"
                  : "Inventario"}
          </h1>
          <p>
            {activeSection === "dashboard"
              ? "Vista ejecutiva del estado actual de la operacion y la configuracion base."
              : activeSection === "inventory"
                ? "Consulta existencias, costos, ventas potenciales y productos que vencen dentro de los proximos dos meses."
                : activeSection === "inventory-entry"
                  ? "Registra entradas de inventario manualmente o cargando el Excel generado desde Facturacion."
              : activeSection === "orders"
                ? "Consulta los pedidos enviados por vendedores y revisa su detalle antes de preparar el despacho."
              : activeSection === "catalog"
                ? "Arma catalogos por categorias o productos, luego define el precio de venta por cliente con un porcentaje global o ajustes manuales."
              : activeSection === "imports"
                ? "Registra contenedores, define gastos generales de exportacion y distribuye el costo real entre los productos recibidos."
                : activeSection === "import-billing"
                  ? "Selecciona una exportacion guardada, aplica un margen global y calcula precios de venta en USD usando TRM del dia."
              : activeSection === "accounting"
                ? "Registra costos fijos y monitorea gastos operacionales para entender la carga mensual del negocio."
              : activeSection === "logistics-accounting"
                ? "Visualiza las utilidades de pedidos despachados a clientes, en florines (AWG), con costos adicionales de la operacion logistica."
              : activeSection === "warehouses"
                ? "Crea bodegas y organiza cada una por estantes, pisos y racks para ubicar productos fisicamente."
              : isCreationSection
                ? selectedCollection.description
                : activeSection === "routes"
                  ? "Disena la cobertura semanal por vendedor y asigna el listado de tiendas a visitar cada dia."
                  : "Consulta existencias, costos y vencimientos del inventario."}
          </p>
        </header>

        {activeSection === "dashboard" ? (
          <section className="dashboard-layout">
            <div className="dashboard-grid">
              {isLoadingKpis
                ? kpiPlaceholders.map((placeholder) => (
                    <article key={placeholder} className="kpi-card is-loading" />
                  ))
                : dashboardExecutiveCards.map((card) => {
                    const targetSection = card.targetSection;

                    return (
                      <button
                        key={card.label}
                        className={`kpi-card kpi-card-button tone-${card.tone} ${activeSection === targetSection ? "is-active" : ""}`}
                        type="button"
                        onClick={() => targetSection ? setActiveSection(targetSection) : undefined}
                        disabled={!targetSection}
                      >
                        <p>{card.label}</p>
                        <strong>{card.valueLabel}</strong>
                      </button>
                    );
                  })}
            </div>

            <div className="dashboard-table-grid">
              <article className="database-card">
                <div className="management-table-header">
                  <div>
                    <h2>Productos mas vendidos</h2>
                    <p>Unidades despachadas acumuladas en pedidos entregados.</p>
                  </div>
                </div>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>SKU</th>
                        <th>Unidades</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardTopSellingProducts.length > 0 ? (
                        dashboardTopSellingProducts.map((row) => (
                          <tr key={row.productId}>
                            <td>{row.productName}</td>
                            <td>{row.productSku}</td>
                            <td>{row.totalUnits}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="empty-table-cell">Aun no hay productos vendidos.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </article>

              <article className="database-card">
                <div className="management-table-header">
                  <div>
                    <h2>Productos menos vendidos</h2>
                    <p>Productos con menor salida entre los pedidos ya entregados.</p>
                  </div>
                </div>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>SKU</th>
                        <th>Unidades</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardLowestSellingProducts.length > 0 ? (
                        dashboardLowestSellingProducts.map((row) => (
                          <tr key={row.productId}>
                            <td>{row.productName}</td>
                            <td>{row.productSku}</td>
                            <td>{row.totalUnits}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="empty-table-cell">Aun no hay productos vendidos.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </article>

              <article className="database-card">
                <div className="management-table-header">
                  <div>
                    <h2>Productos proximos a vencerse</h2>
                    <p>Inventario con vencimiento cercano en los proximos dos meses.</p>
                  </div>
                </div>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>SKU</th>
                        <th>Vence</th>
                        <th>Stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardExpiringProducts.length > 0 ? (
                        dashboardExpiringProducts.map((row) => (
                          <tr key={row.productId}>
                            <td>{row.name}</td>
                            <td>{row.sku}</td>
                            <td>{String(row.expirationDate).slice(0, 10)}</td>
                            <td>{row.quantity}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="empty-table-cell">No hay productos proximos a vencerse.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </article>

              <article className="database-card">
                <div className="management-table-header">
                  <div>
                    <h2>Clientes con mas facturacion</h2>
                    <p>Clientes con mayor venta acumulada segun pedidos facturados.</p>
                  </div>
                </div>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>Pedidos facturados</th>
                        <th>Facturacion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardTopBillingClients.length > 0 ? (
                        dashboardTopBillingClients.map((row) => (
                          <tr key={row.clientName}>
                            <td>{row.clientName}</td>
                            <td>{row.invoiceCount}</td>
                            <td>{formatAwgCurrency(row.totalRevenue)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="empty-table-cell">Aun no hay clientes con facturacion registrada.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </article>

              <article className="database-card">
                <div className="management-table-header">
                  <div>
                    <h2>Clientes con menos facturacion</h2>
                    <p>Clientes con menor venta acumulada entre los pedidos facturados.</p>
                  </div>
                </div>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>Pedidos facturados</th>
                        <th>Facturacion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardLowestBillingClients.length > 0 ? (
                        dashboardLowestBillingClients.map((row) => (
                          <tr key={row.clientName}>
                            <td>{row.clientName}</td>
                            <td>{row.invoiceCount}</td>
                            <td>{formatAwgCurrency(row.totalRevenue)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="empty-table-cell">Aun no hay clientes con facturacion registrada.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </article>
            </div>
          </section>
        ) : isCreationSection ? (
          <section className="creation-layout">
            <div className="management-overview">
              <div className="management-kpi-grid">
                {isLoadingCreationRows
                  ? Array.from({ length: 4 }, (_, index) => <article key={index} className="kpi-card is-loading" />)
                  : creationSectionKpis.map((card) => (
                      <article key={card.label} className={`kpi-card tone-${card.tone}`}>
                        <p>{card.label}</p>
                        <strong>{card.value}</strong>
                      </article>
                    ))}
              </div>

              <div className="management-action-panel">
                <p className="section-label">Crear</p>
                <h2>Nuevo registro</h2>
                <p>Abre un modal para registrar nueva informacion en esta seccion.</p>
                <button className="primary-action-button" type="button" onClick={openCreationModal}>
                  Crear registro
                </button>
              </div>
            </div>

            {creationStatuses[selectedCollection.key] ? (
              <p className={`form-feedback ${creationStatuses[selectedCollection.key]?.tone}`}>
                {creationStatuses[selectedCollection.key]?.message}
              </p>
            ) : null}

            <article className="database-card">
              <div className="management-table-header">
                <div>
                  <h2>Registros creados</h2>
                  <p>Consulta, filtra y revisa la informacion cargada para esta seccion.</p>
                </div>
                <p className="management-table-meta">{filteredCreationRows.length} resultados</p>
              </div>

              <div className="filter-grid">
                <label className="field">
                  <span>Busqueda general</span>
                  <input
                    type="text"
                    value={currentSectionFilters.search}
                    placeholder="Buscar en la tabla"
                    onInput={(event) => handleSectionFilterChange("search", event.currentTarget.value)}
                    onChange={(event) => handleSectionFilterChange("search", event.target.value)}
                  />
                </label>

                <label className="field">
                  <span>{primaryFilter.label}</span>
                  <input
                    type="text"
                    value={currentSectionFilters.primary}
                    placeholder={primaryFilter.placeholder}
                    onInput={(event) => handleSectionFilterChange("primary", event.currentTarget.value)}
                    onChange={(event) => handleSectionFilterChange("primary", event.target.value)}
                  />
                </label>

                <label className="field">
                  <span>{secondaryFilter.label}</span>
                  <input
                    type="text"
                    value={currentSectionFilters.secondary}
                    placeholder={secondaryFilter.placeholder}
                    onInput={(event) => handleSectionFilterChange("secondary", event.currentTarget.value)}
                    onChange={(event) => handleSectionFilterChange("secondary", event.target.value)}
                  />
                </label>
              </div>

              {creationRowsError ? <p className="form-feedback error">{creationRowsError}</p> : null}

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      {selectedCollection.tableColumns.map((column) => (
                        <th key={column.key}>{column.label}</th>
                      ))}
                      <th>Accion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingCreationRows ? (
                      <tr>
                        <td colSpan={selectedCollection.tableColumns.length + 1} className="empty-table-cell">
                          Cargando registros...
                        </td>
                      </tr>
                    ) : filteredCreationRows.length > 0 ? (
                      filteredCreationRows.map((row, index) => (
                        <tr key={String(row._id ?? `${selectedCollection.key}-${index}`)}>
                          {selectedCollection.tableColumns.map((column) => (
                            <td key={column.key}>{formatCreationCellValue(row, column.key)}</td>
                          ))}
                          <td>
                            <div className="table-action-group">
                              <button
                                className="table-action-icon"
                                type="button"
                                aria-label="Modificar registro"
                                title="Modificar"
                                onClick={() => openEditModal(row)}
                              >
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                  <path d="M4 20h4l10-10-4-4L4 16v4zm12.7-12.3 1.6-1.6a1 1 0 0 1 1.4 0l1.2 1.2a1 1 0 0 1 0 1.4L19.3 10l-2.6-2.3z" fill="currentColor" />
                                </svg>
                              </button>
                              <button
                                className="table-action-icon is-danger"
                                type="button"
                                aria-label="Borrar registro"
                                title="Borrar"
                                onClick={() => void handleDeleteCreationRow(selectedCollection, row)}
                              >
                                x
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={selectedCollection.tableColumns.length + 1} className="empty-table-cell">
                          No hay registros que coincidan con los filtros actuales.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            {activeSection === "warehouses" ? (
              <section className="warehouse-layout">
                <article className="creation-selector-block">
                  <p className="section-label">Organizacion fisica</p>
                  <h2>Selecciona la bodega que vas a organizar</h2>
                  <p className="route-helper-text">
                    Elige una bodega y asigna cada producto a una combinacion de estante, piso y rack.
                  </p>

                  <label className="field creation-selector-field">
                    <span>Bodega</span>
                    <select
                      name="warehouseSelector"
                      value={selectedWarehouseId}
                      onChange={(event) => setSelectedWarehouseId(event.target.value)}
                      disabled={warehouseOptions.length === 0}
                    >
                      {warehouseOptions.length === 0 ? <option value="">Primero crea una bodega</option> : null}
                      {warehouseOptions.map((warehouse) => (
                        <option key={warehouse.value} value={warehouse.value}>
                          {warehouse.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  {selectedWarehouse ? (
                    <p className="warehouse-selected-meta">
                      {selectedWarehouse.code} · {selectedWarehouse.address || "Sin direccion"}
                    </p>
                  ) : null}
                </article>

                <article className="route-builder-card">
                  <div className="creation-header database-header">
                    <div>
                      <h2>Asignar producto a ubicacion</h2>
                      <p>Define donde se guarda cada producto dentro de la bodega seleccionada.</p>
                    </div>
                  </div>

                  <form className="warehouse-form" onInputCapture={handlePortalInputCapture} onSubmit={(event) => void handleWarehouseLocationSubmit(event)}>
                    <div className="warehouse-form-grid">
                      <label className="field field-full">
                        <span>Producto</span>
                        <select
                          value={warehouseLocationForm.productId}
                          onChange={(event) => handleWarehouseLocationFieldChange("productId", event.target.value)}
                          disabled={productOptions.length === 0 || Boolean(editingWarehouseLocationId)}
                          required
                        >
                          {productOptions.length === 0 ? <option value="">Primero crea un producto</option> : null}
                          {productOptions.map((product) => (
                            <option key={product.value} value={product.value}>
                              {product.label} ({product.sku})
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="field field-third">
                        <span>Estante</span>
                        <input
                          type="text"
                          value={warehouseLocationForm.shelf}
                          placeholder="B"
                          onChange={(event) => handleWarehouseLocationFieldChange("shelf", event.target.value)}
                          required
                        />
                      </label>

                      <label className="field field-third">
                        <span>Piso</span>
                        <input
                          type="text"
                          value={warehouseLocationForm.floor}
                          placeholder="2"
                          onChange={(event) => handleWarehouseLocationFieldChange("floor", event.target.value)}
                          required
                        />
                      </label>

                      <label className="field field-third">
                        <span>Rack</span>
                        <input
                          type="text"
                          value={warehouseLocationForm.rack}
                          placeholder="4"
                          onChange={(event) => handleWarehouseLocationFieldChange("rack", event.target.value)}
                          required
                        />
                      </label>
                    </div>

                    {warehouseLocationStatus ? (
                      <p className={`form-feedback ${warehouseLocationStatus.tone}`}>{warehouseLocationStatus.message}</p>
                    ) : null}

                    <button
                      className="submit-button"
                      type="submit"
                      disabled={isSavingWarehouseLocation || warehouseOptions.length === 0 || productOptions.length === 0}
                    >
                      {isSavingWarehouseLocation
                        ? "Guardando ubicacion..."
                        : editingWarehouseLocationId
                          ? "Guardar cambios"
                          : "Guardar ubicacion"}
                    </button>

                    {editingWarehouseLocationId ? (
                      <button className="modal-close-button form-span-full" type="button" onClick={cancelWarehouseLocationEdit}>
                        Cancelar edicion
                      </button>
                    ) : null}
                  </form>
                </article>

                <article className="database-card">
                  <div className="creation-header database-header">
                    <div>
                      <h2>Mapa actual de la bodega</h2>
                      <p>Consulta rapidamente donde esta ubicado cada producto dentro de la bodega seleccionada.</p>
                    </div>
                  </div>

                  {warehouseLocationError ? <p className="form-feedback error">{warehouseLocationError}</p> : null}

                  <div className="warehouse-location-list">
                    {isLoadingWarehouseLocations ? (
                      <article className="warehouse-location-card is-loading" />
                    ) : warehouseLocations.length > 0 ? (
                      warehouseLocations.map((location) => (
                        <article className="warehouse-location-card" key={location._id ?? `${location.productId}-${location.warehouseId}`}>
                          <div className="warehouse-location-header">
                            <div>
                              <p className="section-label">{location.productSku}</p>
                              <h3>{location.productName}</h3>
                            </div>
                            <div className="warehouse-location-tools">
                              <div className="warehouse-location-badge">
                                Estante {location.shelf} · Piso {location.floor} · Rack {location.rack}
                              </div>
                              <div className="table-action-group">
                                <button
                                  className="table-action-icon"
                                  type="button"
                                  aria-label="Modificar ubicacion"
                                  title="Modificar"
                                  onClick={() => startWarehouseLocationEdit(location)}
                                >
                                  <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="M4 20h4l10-10-4-4L4 16v4zm12.7-12.3 1.6-1.6a1 1 0 0 1 1.4 0l1.2 1.2a1 1 0 0 1 0 1.4L19.3 10l-2.6-2.3z" fill="currentColor" />
                                  </svg>
                                </button>
                                <button
                                  className="table-action-icon is-danger"
                                  type="button"
                                  aria-label="Borrar ubicacion"
                                  title="Borrar"
                                  onClick={() => void handleDeleteWarehouseLocation(location)}
                                >
                                  x
                                </button>
                              </div>
                            </div>
                          </div>
                        </article>
                      ))
                    ) : (
                      <p className="warehouse-empty-state">Aun no hay productos organizados en esta bodega.</p>
                    )}
                  </div>
                </article>
              </section>
            ) : null}
          </section>
        ) : activeSection === "catalog" ? (
          <section className="catalog-layout">
            <article className="creation-selector-block">
              <p className="section-label">Catalogos comerciales</p>
              <h2>{editingCatalogId ? "Modificar catalogo" : "Crear catalogo"}</h2>
              <p>Selecciona productos o categorias para armar la base del catalogo que luego enviaras a cada cliente.</p>
            </article>

            <article className="route-builder-card">
              <div className="catalog-created-panel">
                <div className="management-table-header">
                  <div>
                    <h2>Catalogos creados</h2>
                    <p>Administra las estructuras base que despues personalizaras por cliente.</p>
                  </div>
                  <p className="management-table-meta">{catalogs.length} resultados</p>
                </div>

                {catalogError ? <p className="form-feedback error">{catalogError}</p> : null}
                {catalogStatus ? <p className={`form-feedback ${catalogStatus.tone}`}>{catalogStatus.message}</p> : null}

                <div className="catalog-record-list is-compact">
                  {isLoadingCatalogs ? (
                    <article className="route-summary-card is-loading" />
                  ) : catalogs.length > 0 ? (
                    catalogs.map((catalog) => (
                      <article className="catalog-record-card is-compact" key={catalog._id ?? catalog.code}>
                        <div>
                          <p className="section-label">{catalog.code}</p>
                          <h3>{catalog.name}</h3>
                          <p>{catalog.description || "Sin descripcion"}</p>
                        </div>
                        <div className="catalog-record-meta">
                          <span>{catalog.categoryNames.length} categorias</span>
                          <span>{catalog.productIds.length} productos directos</span>
                          <span>{catalog.availableForOrders ? "Disponible en pedidos" : "Pendiente por guardar para pedidos"}</span>
                        </div>
                        <div className="table-action-group">
                          <button
                            className="table-action-icon"
                            type="button"
                            aria-label="Modificar catalogo"
                            title="Modificar"
                            onClick={() => startCatalogEdit(catalog)}
                          >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M4 20h4l10-10-4-4L4 16v4zm12.7-12.3 1.6-1.6a1 1 0 0 1 1.4 0l1.2 1.2a1 1 0 0 1 0 1.4L19.3 10l-2.6-2.3z" fill="currentColor" />
                            </svg>
                          </button>
                          <button
                            className="table-action-icon is-danger"
                            type="button"
                            aria-label="Borrar catalogo"
                            title="Borrar"
                            onClick={() => void handleDeleteCatalog(catalog)}
                          >
                            x
                          </button>
                        </div>
                      </article>
                    ))
                  ) : (
                    <p className="route-empty-state">Aun no hay catalogos creados.</p>
                  )}
                </div>
              </div>

              <form className="route-builder-form" onInputCapture={handlePortalInputCapture} onSubmit={(event) => void handleCatalogSubmit(event)}>
                <div className="route-form-grid">
                  <label className="field field-two-third">
                    <span>Nombre del catalogo</span>
                    <input
                      type="text"
                      value={catalogForm.name}
                      placeholder="CATALOGO FRUTAS PREMIUM"
                      onChange={(event) => handleCatalogFieldChange("name", event.target.value)}
                      required
                    />
                  </label>

                  <label className="field field-third">
                    <span>Seleccion actual</span>
                    <input
                      type="text"
                      value={`${catalogForm.categoryNames.length} categorias · ${catalogForm.productIds.length} productos`}
                      readOnly
                    />
                  </label>

                  <label className="field field-full">
                    <span>Descripcion</span>
                    <textarea
                      rows={3}
                      value={catalogForm.description}
                      placeholder="Uso sugerido, temporada o enfoque comercial del catalogo."
                      onChange={(event) => handleCatalogFieldChange("description", event.target.value)}
                    />
                  </label>
                </div>

                <div className="catalog-selection-grid">
                  <article className="route-day-card">
                    <div className="route-day-header">
                      <h3>Categorias</h3>
                      <span>{catalogForm.categoryNames.length} seleccionadas</span>
                    </div>

                    <div className="route-store-list">
                      {categoryOptions.length === 0 ? (
                        <p className="route-empty-state">Primero crea categorias.</p>
                      ) : (
                        categoryOptions.map((category) => (
                          <label className="route-store-option" key={category.value}>
                            <input
                              type="checkbox"
                              checked={catalogForm.categoryNames.includes(category.value)}
                              onChange={() => toggleCatalogCategory(category.value)}
                            />
                            <span>
                              <strong>{category.label}</strong>
                              <small>Incluye todos los productos de esta categoria.</small>
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                  </article>

                  <article className="route-day-card">
                    <div className="route-day-header">
                      <h3>Productos directos</h3>
                      <span>{catalogForm.productIds.length} seleccionados</span>
                    </div>

                    <div className="route-store-list">
                      {productOptions.length === 0 ? (
                        <p className="route-empty-state">Primero crea productos.</p>
                      ) : (
                        productOptions.map((product) => (
                          <label className="route-store-option" key={product.value}>
                            <input
                              type="checkbox"
                              checked={catalogForm.productIds.includes(product.value)}
                              onChange={() => toggleCatalogProduct(product.value)}
                            />
                            <span>
                              <strong>{product.label}</strong>
                              <small>SKU {product.sku}</small>
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                  </article>
                </div>

                <div className="catalog-form-actions">
                  <button className="submit-button" type="submit" disabled={isSavingCatalog}>
                    {isSavingCatalog ? "Guardando catalogo..." : editingCatalogId ? "Guardar cambios" : "Guardar catalogo"}
                  </button>
                  {editingCatalogId ? (
                    <button className="ghost-button" type="button" onClick={() => resetCatalogForm()}>
                      Cancelar edicion
                    </button>
                  ) : null}
                </div>
              </form>
            </article>

            <article className="database-card">
              <div className="accounting-block-header">
                <div>
                  <p className="section-label">Catalogo por cliente</p>
                  <h2>Define los precios de venta</h2>
                  <p>Agrega los clientes destino y define un catalogo general para reutilizar el mismo PDF y la misma estructura de precios.</p>
                </div>
              </div>

              <div className="catalog-pricing-toolbar">
                <label className="field">
                  <span>Clientes destino</span>
                  <select
                    value=""
                    onChange={(event) => addCatalogRecipient(event.target.value)}
                    disabled={storeOptions.length === 0 || selectedCatalogClients.length === storeOptions.length}
                  >
                    <option value="">Agrega un cliente</option>
                    {storeOptions.map((store) => (
                      <option key={store.value} value={store.value} disabled={selectedCatalogClientIds.includes(store.value)}>{selectedCatalogClientIds.includes(store.value) ? `${store.label} · agregado` : store.label}</option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Catalogo creado</span>
                  <select
                    value={selectedCatalogId}
                    onChange={(event) => setSelectedCatalogId(event.target.value)}
                    disabled={catalogs.length === 0}
                  >
                    <option value="">Selecciona un catalogo</option>
                    {catalogs.map((catalog) => (
                      <option key={catalog._id ?? catalog.code} value={catalog._id}>{catalog.name}</option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>% sobre costo</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={catalogPricingMarkup}
                    onChange={(event) => setCatalogPricingMarkup(event.target.value)}
                    placeholder="15"
                  />
                </label>

                <button className="ghost-button catalog-apply-button" type="button" onClick={applyCatalogMarkup}>
                  Aplicar %
                </button>
              </div>

              <div className="catalog-recipient-panel">
                <div className="catalog-recipient-header">
                  <p>
                    {selectedCatalogClients.length > 0
                      ? `${selectedCatalogClients.length} cliente${selectedCatalogClients.length === 1 ? "" : "s"} agregado${selectedCatalogClients.length === 1 ? "" : "s"} para este catalogo.`
                      : "Todavia no has agregado clientes destino."}
                  </p>

                  {selectedCatalogClients.length > 0 ? (
                    <button className="ghost-button catalog-recipient-clear-button" type="button" onClick={clearCatalogRecipients}>
                      Limpiar lista
                    </button>
                  ) : null}
                </div>

                {selectedCatalogClients.length > 0 ? (
                  <div className="catalog-recipient-list">
                    {selectedCatalogClients.map((client) => (
                      <button
                        key={client.value}
                        className="catalog-recipient-pill"
                        type="button"
                        onClick={() => removeCatalogRecipient(client.value)}
                      >
                        <span>{client.label}</span>
                        <strong>Quitar</strong>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="catalog-recipient-empty">Selecciona clientes desde el desplegable para construir la lista de envio.</p>
                )}
              </div>

              {selectedCatalogRecord ? (
                <p className="warehouse-selected-meta">
                  Catalogo activo: <strong>{selectedCatalogRecord.name}</strong>
                </p>
              ) : null}

              <p className="warehouse-selected-meta">
                Usa <strong>Guardar cambios</strong> para dejar guardados los precios por cliente que luego se usan en el portal de bodega.
              </p>

              {catalogPreviewError ? <p className="form-feedback error">{catalogPreviewError}</p> : null}
              {catalogPricingStatus ? <p className={`form-feedback ${catalogPricingStatus.tone}`}>{catalogPricingStatus.message}</p> : null}
              {catalogWhatsappStatus ? <p className={`form-feedback ${catalogWhatsappStatus.tone}`}>{catalogWhatsappStatus.message}</p> : null}

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Producto</th>
                      <th>Categoria</th>
                      <th>Costo (AWG)</th>
                      <th>Precio de venta (AWG)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingCatalogPreview ? (
                      <tr>
                        <td colSpan={5} className="empty-table-cell">Cargando productos del catalogo...</td>
                      </tr>
                    ) : catalogPreviewItems.length > 0 ? (
                      catalogPreviewItems.map((item) => {
                        const inventoryRow = inventoryRowsByProductId.get(item.productId);
                        const productOption = productOptionsById.get(item.productId);
                        const unitLabel = formatUnitsPerBoxUnitLabel(productOption?.unitsPerBoxUnit ?? "unidad");

                        return (
                          <tr key={item.productId}>
                            <td>{item.sku}</td>
                            <td>{item.name}</td>
                            <td>{item.category || "-"}</td>
                            <td>{`${formatCurrencyUpTwoDecimals(item.cost)} (${unitLabel})`}</td>
                            <td>
                              <input
                                className="catalog-price-input"
                                type="number"
                                min="0"
                                step="any"
                                value={item.salePrice}
                                placeholder="0.00"
                                onChange={(event) => handleCatalogPricingValueChange(item.productId, event.target.value)}
                              />
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="empty-table-cell">Selecciona un catalogo para ver sus productos.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="catalog-form-actions">
                <button
                  className="submit-button catalog-action-button catalog-generate-button"
                  type="button"
                  onClick={() => void handleCatalogPricingSubmit()}
                  disabled={isSavingCatalogPricing || isSendingCatalogWhatsapp || !selectedCatalogId || selectedCatalogClientIds.length === 0 || catalogPreviewItems.length === 0}
                >
                  {isSavingCatalogPricing ? "Guardando cambios..." : "Guardar cambios"}
                </button>

                <button
                  className="ghost-button catalog-action-button catalog-whatsapp-button"
                  type="button"
                  onClick={() => void handleCatalogPdfDownload()}
                  disabled={isSendingCatalogWhatsapp || isSavingCatalogPricing || !selectedCatalogId || catalogPreviewItems.length === 0}
                >
                  Descargar PDF del catalogo
                </button>

                <button
                  className="ghost-button catalog-action-button catalog-whatsapp-button"
                  type="button"
                  onClick={toggleCatalogWhatsappComposer}
                  disabled={isSendingCatalogWhatsapp || isSavingCatalogPricing || !selectedCatalogId || selectedCatalogClientIds.length === 0 || catalogPreviewItems.length === 0}
                >
                  {isCatalogWhatsappComposerOpen
                    ? "Ocultar envio por WhatsApp"
                    : "Preparar envio por WhatsApp a clientes seleccionados"}
                </button>
              </div>

              {isCatalogWhatsappComposerOpen ? (
                <div className="catalog-whatsapp-composer">
                  <div className="catalog-whatsapp-composer-header">
                    <div>
                      <p className="section-label">Envio por WhatsApp</p>
                      <h3>Redacta y adjunta el catalogo</h3>
                      <p>Escribe el mensaje, adjunta el PDF generado y luego envialo a los clientes seleccionados.</p>
                    </div>

                    <button className="ghost-button catalog-whatsapp-close-button" type="button" onClick={toggleCatalogWhatsappComposer}>
                      Cerrar
                    </button>
                  </div>

                  <label className="field field-full">
                    <span>Mensaje</span>
                    <textarea
                      rows={4}
                      value={catalogWhatsappMessage}
                      placeholder="Escribe el mensaje que deseas enviar junto al catalogo."
                      onChange={(event) => setCatalogWhatsappMessage(event.target.value)}
                    />
                  </label>

                  <p className="catalog-whatsapp-help">Puedes usar {"{{cliente}}"}, {"{{catalogo}}"} y {"{{archivo}}"} dentro del mensaje.</p>

                  <div className="catalog-whatsapp-composer-actions">
                    <button
                      className="ghost-button catalog-whatsapp-attach-button"
                      type="button"
                      onClick={() => void attachGeneratedCatalogPdfToWhatsapp()}
                      disabled={isPreparingCatalogWhatsappAttachment || isSendingCatalogWhatsapp}
                    >
                      {isPreparingCatalogWhatsappAttachment
                        ? "Adjuntando PDF generado..."
                        : catalogWhatsappAttachment
                          ? "Volver a adjuntar PDF generado"
                          : "Adjuntar PDF generado"}
                    </button>

                    <div className="catalog-whatsapp-attachment-summary">
                      {catalogWhatsappAttachment ? (
                        <>
                          <strong>{catalogWhatsappAttachment.file.name}</strong>
                          <span>Generado el {catalogWhatsappAttachment.generatedAtLabel}</span>
                        </>
                      ) : (
                        <span>Aun no hay archivo adjunto. Usa el boton para generar y adjuntar el PDF del catalogo.</span>
                      )}
                    </div>

                    <button
                      className="submit-button catalog-action-button catalog-whatsapp-send-button"
                      type="button"
                      onClick={() => void handleCatalogWhatsappSend()}
                      disabled={isSendingCatalogWhatsapp || isPreparingCatalogWhatsappAttachment}
                    >
                      {isSendingCatalogWhatsapp ? "Enviando catalogo por WhatsApp..." : "Enviar por WhatsApp"}
                    </button>
                  </div>
                </div>
              ) : null}

            </article>
          </section>
        ) : activeSection === "imports" ? accountingView === "container-import" ? (
          <section className="accounting-layout">
            <article className="database-card import-page-card">
              <div className="accounting-block-header">
                <div>
                  <p className="section-label">Registro de contenedor</p>
                  <h2>{editingImportBatchReference ? "Modificar exportacion" : "Registrar exportacion"}</h2>
                  <p>
                    Crea primero el envio con sus productos y luego agrega o ajusta los gastos que correspondan con sus facturas.
                  </p>
                </div>
                <button className="modal-close-button" type="button" onClick={closeImportCostPage}>Volver a exportaciones</button>
              </div>

              <form className="import-page-form" onInputCapture={handlePortalInputCapture} onSubmit={(event) => void handleImportCostSubmit(event)}>
                <div className="creation-form import-page-grid">
                  <label className="field field-full">
                    <span>Plantilla guardada</span>
                    <div className="catalog-form-actions">
                      <select
                        value={selectedImportTemplateId}
                        onChange={(event) => setSelectedImportTemplateId(event.target.value)}
                      >
                        <option value="">Selecciona una plantilla</option>
                        {importContainerTemplates.map((template) => (
                          <option key={template.id} value={template.id}>{template.name}</option>
                        ))}
                      </select>
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => applySelectedImportTemplate(selectedImportTemplateId)}
                        disabled={!selectedImportTemplateId}
                      >
                        Aplicar plantilla
                      </button>
                    </div>
                  </label>

                  <label className="field field-third">
                    <span>Tipo de contenedor</span>
                    <select
                      value={containerImportForm.containerType}
                      onChange={(event) => handleContainerImportFieldChange("containerType", event.target.value)}
                    >
                      {containerTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>

                  <label className="field field-third">
                    <span>Tamano del contenedor</span>
                    <select
                      value={containerImportForm.containerSize}
                      onChange={(event) => handleContainerImportFieldChange("containerSize", event.target.value)}
                    >
                      {containerSizeOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>

                  <label className="field field-third">
                    <span>Unidades de medida</span>
                    <select
                      value={containerImportForm.measurementUnit}
                      onChange={(event) => handleContainerImportFieldChange("measurementUnit", event.target.value)}
                    >
                      {containerMeasurementUnitOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>

                  <label className="field field-third">
                    <span>Fecha exportacion</span>
                    <input
                      type="date"
                      value={containerImportForm.importDate}
                      onChange={(event) => handleContainerImportFieldChange("importDate", event.target.value)}
                      required
                    />
                  </label>

                  <label className="field field-third">
                    <span>Nombre o tracking de envio</span>
                    <input
                      type="text"
                      value={containerImportForm.shipmentReference}
                      placeholder="BL-2026-001"
                      onChange={(event) => handleContainerImportFieldChange("shipmentReference", event.target.value)}
                    />
                  </label>

                  <label className="field field-full">
                    <span>Notas</span>
                    <textarea
                      rows={3}
                      value={containerImportForm.notes}
                      placeholder="Observaciones del contenedor, proveedor o condiciones de compra."
                      onChange={(event) => handleContainerImportFieldChange("notes", event.target.value)}
                    />
                  </label>
                </div>

                <article className="import-expense-card">
                  <div className="management-table-header">
                    <div>
                      <p className="section-label">Gastos del envio</p>
                      <h3>Agrega uno o varios gastos</h3>
                      <p>Selecciona el tipo de gasto, escribe el valor y adjunta las facturas que soportan ese costo.</p>
                    </div>
                    <button className="ghost-button import-expense-add-button" type="button" onClick={addImportExpenseItem}>
                      Agregar gasto
                    </button>
                  </div>

                  <div className="import-expense-list">
                    {containerImportForm.expenseItems.filter((e) => !e.saved).length === 0 ? (
                      <p className="warehouse-empty-state">Aun no has agregado gastos a este envio.</p>
                    ) : (
                      containerImportForm.expenseItems.filter((e) => !e.saved).map((expense) => (
                        <article className="import-expense-item" key={expense.id}>
                          <div className="import-expense-grid">
                            <label className="field">
                              <span>Tipo de gasto</span>
                              <select
                                value={expense.key}
                                onChange={(event) => handleImportExpenseItemChange(expense.id, "key", event.target.value)}
                              >
                                {importExpenseTypeOptions.map((option) => (
                                  <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                              </select>
                            </label>

                            <label className="field">
                              <span>{expense.key === "other" ? "Nombre del gasto" : "Nombre"}</span>
                              <input
                                type="text"
                                value={expense.label}
                                placeholder={expense.key === "other" ? "INSPECCION, SEGURO, ETC." : "Nombre del gasto"}
                                onChange={(event) => handleImportExpenseItemChange(expense.id, "label", event.target.value)}
                                disabled={expense.key !== "other"}
                              />
                            </label>

                            <label className="field">
                              <span>Valor (COP)</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={expense.amount}
                                placeholder="250000"
                                onChange={(event) => handleImportExpenseItemChange(expense.id, "amount", event.target.value)}
                              />
                            </label>

                            <label className="field">
                              <span>Factura</span>
                              <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png,.webp"
                                onChange={(event) => {
                                  const file = event.target.files?.[0] ?? null;
                                  void handleImportExpenseDocumentUpload(expense.id, file);
                                  event.currentTarget.value = "";
                                }}
                              />
                            </label>

                            <div className="field field-action-end">
                              <button
                                className="expense-save-btn"
                                type="button"
                                onClick={() => saveImportExpenseItem(expense.id)}
                              >
                                Guardar
                              </button>
                            </div>
                          </div>

                          {expense.error ? <p className="form-feedback error">{expense.error}</p> : null}
                          {expense.isUploading ? <p className="form-feedback success">Subiendo factura...</p> : null}

                          {expense.documents.length > 0 ? (
                            <div className="import-expense-documents">
                              {expense.documents.map((document) => (
                                <div className="import-expense-document" key={document.url}>
                                  <a href={document.url} target="_blank" rel="noreferrer">{document.name}</a>
                                  <button
                                    className="table-action-icon is-danger"
                                    type="button"
                                    onClick={() => removeImportExpenseDocument(expense.id, document.url)}
                                    aria-label="Borrar factura"
                                    title="Borrar factura"
                                  >
                                    x
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : null}

                          <div className="catalog-form-actions">
                            <button className="ghost-button" type="button" onClick={() => removeImportExpenseItem(expense.id)}>
                              Quitar gasto
                            </button>
                          </div>
                        </article>
                      ))
                    )}
                  </div>

                  {containerImportForm.expenseItems.some((e) => e.saved) && (
                    <div className="import-saved-expenses">
                      <h4 className="import-saved-expenses-title">Gastos registrados</h4>
                      <div className="import-saved-expenses-list">
                        {containerImportForm.expenseItems.filter((e) => e.saved).map((expense) => (
                          <div className="import-saved-expense-row" key={expense.id}>
                            <span className="import-saved-expense-label">{expense.label}</span>
                            <span className="import-saved-expense-amount">
                              {Number(expense.amount || 0).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })}
                            </span>
                            {expense.documents.length > 0 && (
                              <span className="import-saved-expense-docs">
                                {expense.documents.map((doc) => (
                                  <a key={doc.url} href={doc.url} target="_blank" rel="noreferrer" className="import-saved-expense-doc-link">
                                    {doc.name}
                                  </a>
                                ))}
                              </span>
                            )}
                            <button
                              className="table-action-icon import-saved-expense-edit"
                              type="button"
                              onClick={() => unsaveImportExpenseItem(expense.id)}
                              aria-label="Editar gasto"
                              title="Editar gasto"
                            >
                              ✏️
                            </button>
                            <button
                              className="table-action-icon is-danger"
                              type="button"
                              onClick={() => removeImportExpenseItem(expense.id)}
                              aria-label="Eliminar gasto"
                              title="Eliminar gasto"
                            >
                              x
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </article>

                <div className="import-summary-grid">
                  <article className="import-summary-card">
                    <p>Tipo de contenedor</p>
                    <strong>{formatContainerType(containerImportForm.containerType)}</strong>
                  </article>
                  <article className="import-summary-card">
                    <p>Contenedor</p>
                    <strong>{formatContainerSize(containerImportForm.containerSize)}</strong>
                  </article>
                  <article className="import-summary-card">
                    <p>Productos marcados</p>
                    <strong>{selectedContainerImportProducts.length}</strong>
                  </article>
                  <article className="import-summary-card">
                    <p>Gastos generales</p>
                    <strong>{formatCurrency(containerGeneralCostsTotal)}</strong>
                  </article>
                </div>

                <div className="container-capacity-panel">
                  <article className={`container-visual-card ${selectedContainerOverflowByUnit > 0 ? "is-overflow" : ""}`}>
                    <div className="container-visual-header">
                      <div>
                        <p className="section-label">Capacidad del contenedor</p>
                        <h3>Capacidad ocupada</h3>
                      </div>
                      <strong>{Math.min(selectedContainerFillPercentage, 100).toFixed(0)}%</strong>
                    </div>

                    <div className="container-visual-shell" aria-label="Visualizacion del llenado del contenedor">
                      <div className="container-visual-fill" style={{ height: `${selectedContainerFillPercentage}%` }} />
                      <div className="container-visual-grid">
                        <span />
                        <span />
                        <span />
                        <span />
                      </div>
                      <div className="container-visual-outline" />
                    </div>

                    <div className="container-visual-stats">
                      <div>
                        <span>Capacidad total ({containerImportForm.measurementUnit})</span>
                        <strong>{formatContainerMeasure(selectedContainerCapacityByUnit, containerImportForm.measurementUnit)}</strong>
                      </div>
                      <div>
                        <span>Usado ({containerImportForm.measurementUnit})</span>
                        <strong>{formatContainerMeasure(selectedContainerUsedByUnit, containerImportForm.measurementUnit)}</strong>
                      </div>
                      <div>
                        <span>{selectedContainerOverflowByUnit > 0 ? "Exceso" : "Disponible"}</span>
                        <strong>
                          {selectedContainerOverflowByUnit > 0
                            ? formatContainerMeasure(selectedContainerOverflowByUnit, containerImportForm.measurementUnit)
                            : formatContainerMeasure(Math.max(selectedContainerRemainingByUnit, 0), containerImportForm.measurementUnit)}
                        </strong>
                      </div>
                    </div>
                  </article>

                  <article className="container-capacity-breakdown">
                    <div className="container-capacity-breakdown-header">
                      <div>
                        <p className="section-label">Distribucion estimada</p>
                        <h3>Como se llena el contenedor</h3>
                      </div>
                      <p>
                        {selectedContainerVolumeMetrics.length > 0
                          ? `${selectedContainerVolumeMetrics.length} producto${selectedContainerVolumeMetrics.length === 1 ? "" : "s"} incluidos`
                          : "Aun no has agregado productos"}
                      </p>
                    </div>

                    {selectedContainerVolumeMetrics.length > 0 ? (
                      <div className="container-capacity-breakdown-list">
                        {selectedContainerVolumeMetrics.map((metric) => (
                          <article className="container-capacity-breakdown-row" key={metric.product.value}>
                            <div>
                              <strong>{metric.product.label}</strong>
                              <span>
                                {metric.estimatedBoxes} caja{metric.estimatedBoxes === 1 ? "" : "s"} estimada{metric.estimatedBoxes === 1 ? "" : "s"}
                              </span>
                            </div>
                            <strong>
                              {containerImportForm.measurementUnit === "kg"
                                ? metric.hasWeightConfig
                                  ? formatContainerMeasure(metric.estimatedWeightKg, "kg")
                                  : "Sin peso"
                                : metric.hasVolumeConfig
                                  ? formatContainerMeasure(
                                      containerImportForm.measurementUnit === "pie3"
                                        ? metric.estimatedVolumeCubicMeters * cubicFeetPerCubicMeter
                                        : metric.estimatedVolumeCubicMeters,
                                      containerImportForm.measurementUnit,
                                    )
                                  : "Sin volumen"}
                            </strong>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className="warehouse-empty-state">Selecciona productos y cantidades para ver como se distribuye el espacio del contenedor.</p>
                    )}

                    {selectedContainerMetricsWithoutVolume.length > 0 ? (
                      <p className="form-feedback error">
                        {containerImportForm.measurementUnit === "kg"
                          ? "Hay productos seleccionados sin peso por unidad configurado. Ajustalos en Productos antes de cerrar este plan."
                          : "Hay productos seleccionados sin unidades por caja o sin dimensiones configuradas. Ajustalos en Productos antes de cerrar este plan."}
                      </p>
                    ) : null}

                    {selectedContainerOverflowByUnit > 0 ? (
                      <p className="form-feedback error">
                        El contenedor ya esta sobrecargado por {formatContainerMeasure(selectedContainerOverflowByUnit, containerImportForm.measurementUnit)}.
                      </p>
                    ) : selectedContainerVolumeMetrics.length > 0 ? (
                      <p className="form-feedback success">
                        Quedan disponibles {formatContainerMeasure(Math.max(selectedContainerRemainingByUnit, 0), containerImportForm.measurementUnit)} dentro del contenedor.
                      </p>
                    ) : null}
                  </article>
                </div>

                <div className="import-products-card">
                  <div className="management-table-header">
                    <div>
                      <p className="section-label">Productos del contenedor</p>
                      <h3>Arma el contenedor</h3>
                      <p>Selecciona los productos que vas a embarcar y define la cantidad para calcular automaticamente el espacio ocupado.</p>
                    </div>
                    <p className="management-table-meta">Costo base productos: {formatCurrency(selectedContainerImportOriginTotal)}</p>
                  </div>

                  <aside className="container-load-float" aria-live="polite">
                    <p className="container-load-float-label">Carga del contenedor</p>
                    <strong>{selectedContainerFillPercentage.toFixed(1)}%</strong>
                    <div className="container-load-float-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(selectedContainerFillPercentage)}>
                      <span style={{ width: `${Math.min(selectedContainerFillPercentage, 100)}%` }} />
                    </div>
                    <p className="container-load-float-meta">
                      {formatContainerMeasure(selectedContainerUsedByUnit, containerImportForm.measurementUnit)} usados de {formatContainerMeasure(selectedContainerCapacityByUnit, containerImportForm.measurementUnit)}
                    </p>
                    <p className={`container-load-float-status ${selectedContainerOverflowByUnit > 0 ? "is-over" : ""}`}>
                      {selectedContainerOverflowByUnit > 0
                        ? `Exceso: ${formatContainerMeasure(selectedContainerOverflowByUnit, containerImportForm.measurementUnit)}`
                        : `Disponible: ${formatContainerMeasure(Math.max(selectedContainerRemainingByUnit, 0), containerImportForm.measurementUnit)}`}
                    </p>
                  </aside>

                  <div className="import-products-table-wrapper">
                    {productOptions.length === 0 ? (
                      <p className="warehouse-empty-state">Primero crea productos para poder registrarlos dentro del contenedor.</p>
                    ) : (
                      <table className="import-products-table">
                        <thead>
                          <tr>
                            <th></th>
                            <th>Producto</th>
                            <th>Cajas</th>
                            <th>Cantidad</th>
                            <th>Costo unitario (COP)</th>
                            <th>Costo x caja (COP)</th>
                            {savedImportExpenses.map((expense) => (
                              <th key={expense.id}>{expense.label}</th>
                            ))}
                            <th className="import-table-total-col">Costo total unitario</th>
                          </tr>
                        </thead>
                        <tbody>
                          {containerProductMetrics.map((metric) => {
                            const { product, currentProduct } = metric;
                            if (!currentProduct) return null;

                            const unitCost = Number(currentProduct.purchaseUnitCostOrigin || 0);
                            const boxCost = Number(currentProduct.purchaseBoxCostOrigin || 0);
                            const adjustedUnit = boxCost > 0 && metric.unitsPerBox > 0 ? boxCost / metric.unitsPerBox : unitCost;
                            const merch = adjustedUnit * metric.importedQuantity;
                            const share = selectedContainerAdjustedMerchandiseCost > 0 ? merch / selectedContainerAdjustedMerchandiseCost : 0;
                            const expensesPerUnit = savedImportExpenses.map((expense) => {
                              const amt = Number(expense.amount || 0);
                              return metric.importedQuantity > 0 ? (amt * share) / metric.importedQuantity : 0;
                            });
                            const totalUnitCost = adjustedUnit + expensesPerUnit.reduce((s, v) => s + v, 0);

                            return (
                              <tr key={product.value} className={currentProduct.selected ? "is-selected" : ""}>
                                <td className="import-table-check-cell">
                                  <label className="import-product-toggle">
                                    <input
                                      type="checkbox"
                                      checked={currentProduct.selected}
                                      onChange={() => toggleContainerImportProduct(product.value)}
                                    />
                                    <span>Incluir</span>
                                  </label>
                                </td>
                                <td className="import-table-product-cell">
                                  <strong>{product.label}</strong>
                                  <small>SKU {product.sku}</small>
                                  <div className="import-product-meta-details">
                                    <span>
                                      {metric.unitsPerBox > 0
                                        ? `${metric.unitsPerBox} ${formatUnitsPerBoxUnitLabel(metric.product.unitsPerBoxUnit)} / CAJA`
                                        : "SIN UND / CAJA"}
                                    </span>
                                  </div>
                                  {currentProduct.selected && metric.importedQuantity > 0 ? (
                                    <div className={`import-product-volume-badge ${metric.hasVolumeConfig ? "" : "is-missing"}`}>
                                      {metric.hasVolumeConfig
                                        ? `${metric.estimatedBoxes} CAJAS EST. · ${formatCubicMeters(metric.estimatedVolumeCubicMeters)}`
                                        : "CONFIGURA CAJA Y DIMENSIONES"}
                                    </div>
                                  ) : null}
                                </td>
                                <td>
                                  <input
                                    className="import-table-input"
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={currentProduct.boxCount}
                                    placeholder=""
                                    onChange={(event) => handleContainerImportProductFieldChange(product.value, "boxCount", event.target.value)}
                                    disabled={!currentProduct.selected}
                                  />
                                </td>
                                <td>
                                  <input
                                    className="import-table-input"
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={currentProduct.importedQuantity}
                                    placeholder=""
                                    onChange={(event) => handleContainerImportProductFieldChange(product.value, "importedQuantity", event.target.value)}
                                    disabled={!currentProduct.selected}
                                    readOnly={metric.unitsPerBox > 0}
                                  />
                                </td>
                                <td>
                                  <input
                                    className="import-table-input"
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={currentProduct.purchaseUnitCostOrigin}
                                    placeholder=""
                                    onChange={(event) => handleContainerImportProductFieldChange(product.value, "purchaseUnitCostOrigin", event.target.value)}
                                    disabled={!currentProduct.selected}
                                  />
                                </td>
                                <td>
                                  <input
                                    className="import-table-input"
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={currentProduct.purchaseBoxCostOrigin}
                                    placeholder=""
                                    onChange={(event) => handleContainerImportProductFieldChange(product.value, "purchaseBoxCostOrigin", event.target.value)}
                                    disabled={!currentProduct.selected}
                                  />
                                </td>
                                {savedImportExpenses.map((expense, i) => (
                                  <td key={expense.id} className="import-table-expense-col">
                                    {currentProduct.selected && metric.importedQuantity > 0
                                      ? formatCurrency(expensesPerUnit[i] ?? 0)
                                      : "—"}
                                  </td>
                                ))}
                                <td className="import-table-total-col">
                                  {currentProduct.selected && metric.importedQuantity > 0
                                    ? formatCurrency(totalUnitCost)
                                    : "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                {accountingStatuses.importCosts ? <p className={`form-feedback ${accountingStatuses.importCosts.tone}`}>{accountingStatuses.importCosts.message}</p> : null}

                <div className="creation-form import-page-grid">
                  <label className="field field-half">
                    <span>Guardar esta configuracion como plantilla</span>
                    <select
                      value={saveImportAsTemplate ? "yes" : "no"}
                      onChange={(event) => setSaveImportAsTemplate(event.target.value === "yes")}
                    >
                      <option value="no">No</option>
                      <option value="yes">Si</option>
                    </select>
                  </label>

                  <label className="field field-half">
                    <span>Nombre de plantilla (opcional)</span>
                    <input
                      type="text"
                      value={importTemplateName}
                      placeholder="Si lo dejas vacio, se usa un nombre predeterminado"
                      onChange={(event) => setImportTemplateName(event.target.value)}
                      disabled={!saveImportAsTemplate}
                    />
                  </label>
                </div>

                <button
                  className="submit-button"
                  type="submit"
                  disabled={
                    isSavingImportCost ||
                    productOptions.length === 0 ||
                    containerImportForm.expenseItems.some((expense) => expense.isUploading)
                  }
                >
                  {isSavingImportCost
                    ? "Guardando exportacion..."
                    : editingImportBatchReference
                      ? "Guardar cambios de la exportacion"
                      : "Guardar exportacion del contenedor"}
                </button>
              </form>
            </article>
          </section>
        ) : (
          <section className="accounting-layout">
            <div className="accounting-kpi-grid">
              {isLoadingAccounting
                ? Array.from({ length: 4 }, (_, index) => <article key={index} className="kpi-card is-loading" />)
                : importSectionKpis.map((card) => (
                    <article key={card.label} className={`kpi-card tone-${card.tone}`}>
                      <p>{card.label}</p>
                      <strong>
                        {card.label.includes("Costo") || card.label.includes("Gastos")
                          ? formatCurrency(card.value)
                          : card.value}
                      </strong>
                    </article>
                  ))}
            </div>

            {accountingError ? <p className="form-feedback error">{accountingError}</p> : null}

            <article className="database-card">
              <div className="accounting-block-header">
                <div>
                  <p className="section-label">Costo real de exportacion</p>
                  <h2>Exportaciones por lote</h2>
                  <p>
                    Registra contenedores completos, define sus gastos generales y distribuye el costo real entre los productos recibidos.
                  </p>
                </div>
                <button className="primary-action-button" type="button" onClick={openImportCostPage}>Crear exportacion</button>
              </div>

              <div className="filter-grid">
                <label className="field">
                  <span>Busqueda general</span>
                  <input
                    type="text"
                    value={importCostFilters.search}
                    placeholder="Buscar por producto o SKU"
                    onInput={(event) => handleAccountingFilterChange("importCosts", "search", event.currentTarget.value)}
                    onChange={(event) => handleAccountingFilterChange("importCosts", "search", event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Contenedor o envio</span>
                  <input
                    type="text"
                    value={importCostFilters.primary}
                    placeholder="Filtrar por contenedor o envio"
                    onInput={(event) => handleAccountingFilterChange("importCosts", "primary", event.currentTarget.value)}
                    onChange={(event) => handleAccountingFilterChange("importCosts", "primary", event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Mes</span>
                  <input
                    type="text"
                    value={importCostFilters.secondary}
                    placeholder="YYYY-MM"
                    onInput={(event) => handleAccountingFilterChange("importCosts", "secondary", event.currentTarget.value)}
                    onChange={(event) => handleAccountingFilterChange("importCosts", "secondary", event.target.value)}
                  />
                </label>
              </div>

              {accountingStatuses.importCosts ? <p className={`form-feedback ${accountingStatuses.importCosts.tone}`}>{accountingStatuses.importCosts.message}</p> : null}

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Contenedor</th>
                      <th>Envio</th>
                      <th>Costo total</th>
                      <th>Accion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingAccounting ? (
                      <tr>
                        <td colSpan={5} className="empty-table-cell">Cargando exportaciones...</td>
                      </tr>
                    ) : filteredImportBatchRows.length > 0 ? (
                      filteredImportBatchRows.map((row) => (
                        <tr key={row.containerReference}>
                          <td>{String(row.importDate).slice(0, 10)}</td>
                          <td>{row.containerReference ? `${formatContainerSize(row.containerSize ?? "20ft")} · ${row.containerReference}` : formatContainerSize(row.containerSize ?? "20ft")}</td>
                          <td>{row.shipmentReference || "-"}</td>
                          <td>{formatCurrency(row.totalImportCost)}</td>
                          <td>
                            <div className="table-action-group">
                              <button
                                className="table-action-icon"
                                type="button"
                                aria-label="Modificar exportacion"
                                title="Modificar"
                                onClick={() => row.containerReference ? void openImportBatchEdit(row.containerReference) : undefined}
                                disabled={!row.containerReference}
                              >
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                  <path d="M4 20h4l10-10-4-4L4 16v4zm12.7-12.3 1.6-1.6a1 1 0 0 1 1.4 0l1.2 1.2a1 1 0 0 1 0 1.4L19.3 10l-2.6-2.3z" fill="currentColor" />
                                </svg>
                              </button>
                              <button
                                className="table-action-icon is-danger"
                                type="button"
                                aria-label="Borrar exportacion"
                                title="Borrar"
                                onClick={() => void handleDeleteImportBatch(row)}
                              >
                                x
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="empty-table-cell">Aun no hay lotes de exportacion registrados.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="database-card">
              <div className="creation-header database-header">
                <div>
                  <h2>Historial de inventario</h2>
                  <p>Registro de entradas y salidas para trazabilidad de vencidos y demas movimientos.</p>
                </div>
                <p className="management-table-meta">{inventoryHistoryRows.length} movimientos</p>
              </div>

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Producto</th>
                      <th>Movimiento</th>
                      <th>Cantidad</th>
                      <th>Motivo</th>
                      <th>Fuente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventoryHistoryRows.length > 0 ? (
                      inventoryHistoryRows.map((row) => (
                        <tr key={`history-${row.id}`}>
                          <td>{String(row.createdAt).slice(0, 10)}</td>
                          <td>{`${row.productName} (${row.productSku})`}</td>
                          <td>{row.movementType === "entry" ? "Entrada" : "Salida"}</td>
                          <td>{row.quantity}</td>
                          <td>{row.reason || "-"}</td>
                          <td>{row.source || "-"}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="empty-table-cell">Aun no hay movimientos en el historial de inventario.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        ) : activeSection === "import-billing" ? (
          <section className="accounting-layout">
            {accountingError ? <p className="form-feedback error">{accountingError}</p> : null}

            <article className="database-card">
              <div className="accounting-block-header">
                <div>
                  <p className="section-label">Operaciones Col</p>
                  <h2>Facturacion de exportaciones</h2>
                  <p>Selecciona una exportacion guardada para calcular precios de venta en USD desde costos en COP.</p>
                </div>
              </div>

              <div className="import-billing-controls">
                <label className="field import-billing-control">
                  <span>Margen general (%)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={billingMarginPercent}
                    onChange={(event) => setBillingMarginPercent(event.target.value)}
                  />
                  <button className="ghost-button import-billing-apply-button" type="button" onClick={applyBillingMarginToRows}>
                    Aplicar %
                  </button>
                </label>
                <label className="field import-billing-control">
                  <span>TRM del dia (COP por 1 USD)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={billingTrmCopPerUsd}
                    onChange={(event) => {
                      setBillingTrmCopPerUsd(event.target.value);
                      if (isBillingPricingEditable) {
                        setHasPendingBillingPricingChanges(true);
                      }
                    }}
                  />
                  <small>{isLoadingBillingTrm ? "Actualizando TRM..." : "Puedes ajustarla manualmente si hace falta."}</small>
                </label>
              </div>

              <div className="import-billing-layout">
                <aside className="import-billing-list">
                  <h3>Exportaciones guardadas</h3>
                  {isLoadingAccounting ? (
                    <p className="warehouse-empty-state">Cargando exportaciones...</p>
                  ) : billingBatchRows.length === 0 ? (
                    <p className="warehouse-empty-state">No hay exportaciones guardadas.</p>
                  ) : (
                    billingBatchRows.map((row) => (
                      <button
                        key={row.referenceKey}
                        className={`import-billing-item ${selectedBillingReference === row.referenceKey ? "is-active" : ""}`}
                        type="button"
                        onClick={() => setSelectedBillingBatchReference(row.referenceKey)}
                      >
                        <strong>{row.containerReference || formatContainerSize(row.containerSize)}</strong>
                        <span>{row.shipmentReference || "Sin envio"}</span>
                        <small>{String(row.importDate).slice(0, 10)}</small>
                      </button>
                    ))
                  )}
                </aside>

                <div className="import-billing-table-wrap">
                  {selectedBillingBatch ? (
                    <div className="import-billing-selected-meta">
                      <p>
                        <strong>Exportacion:</strong> {formatContainerSize(selectedBillingBatch.containerSize)} · {selectedBillingBatch.containerReference}
                      </p>
                      <p>
                        <strong>Envio:</strong> {selectedBillingBatch.shipmentReference || "-"}
                      </p>
                      {selectedBillingPricingLocked && editingBillingReference !== selectedBillingReference ? (
                        <button
                          className="table-action-icon import-billing-edit-button"
                          type="button"
                          aria-label="Editar precios guardados"
                          title="Editar precios guardados"
                          onClick={() => {
                            setEditingBillingReference(selectedBillingReference);
                            setHasPendingBillingPricingChanges(false);
                          }}
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                            <path d="M4 20h4l10-10-4-4L4 16v4zm12.7-12.3 1.6-1.6a1 1 0 0 1 1.4 0l1.2 1.2a1 1 0 0 1 0 1.4L19.3 10l-2.6-2.3z" fill="currentColor" />
                          </svg>
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Producto</th>
                          <th>SKU</th>
                          <th>Cantidad</th>
                          {showBillingPurchaseColumn ? <th>Compra (COP/u)</th> : null}
                          {showBillingFreightColumn ? <th>Flete (COP/u)</th> : null}
                          {showBillingCustomsColumn ? <th>Aduana (COP/u)</th> : null}
                          {showBillingInlandColumn ? <th>Logistica (COP/u)</th> : null}
                          {showBillingTaxesColumn ? <th>Impuestos (COP/u)</th> : null}
                          {showBillingOthersColumn ? <th>Otros (COP/u)</th> : null}
                          <th>Costo total (COP/u)</th>
                          <th>Venta (USD/u)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedBillingRows.length > 0 ? (
                          selectedBillingRows.map((row, index) => {
                            const quantity = Number(row.importedQuantity || 0);
                            const purchaseUnit = Number(row.purchaseUnitCostOrigin || 0);
                            const freightUnit = quantity > 0 ? Number(row.freightCost || 0) / quantity : 0;
                            const customsUnit = quantity > 0 ? Number(row.customsCost || 0) / quantity : 0;
                            const inlandUnit = quantity > 0 ? Number(row.inlandLogisticsCost || 0) / quantity : 0;
                            const taxesUnit = quantity > 0 ? Number(row.taxesCost || 0) / quantity : 0;
                            const othersUnit = quantity > 0 ? Number(row.otherImportCosts || 0) / quantity : 0;
                            const totalUnitCop = Number(row.landedUnitCost || 0);
                            const saleUnitCop = totalUnitCop * (1 + Math.max(billingMarginValue, 0) / 100);
                            const saleUnitUsd = billingTrmValue > 0 ? saleUnitCop / billingTrmValue : 0;
                            const rowKey = getBillingRowKey(row, index);
                            const suggestedSaleUsd = Number.isFinite(saleUnitUsd)
                              ? (Math.round(saleUnitUsd * 100) / 100).toFixed(2)
                              : "";
                            const persistedSaleUsd = Number(row.invoicedSaleUnitUsd ?? 0);
                            const saleInputValue = billingSaleOverrides[rowKey]
                              ?? (Number.isFinite(persistedSaleUsd) && persistedSaleUsd > 0 ? persistedSaleUsd.toFixed(2) : suggestedSaleUsd);

                            return (
                              <tr key={rowKey}>
                                <td>{row.productName}</td>
                                <td>{row.productSku}</td>
                                <td>{quantity}</td>
                                {showBillingPurchaseColumn ? <td>{formatCurrency(purchaseUnit)}</td> : null}
                                {showBillingFreightColumn ? <td>{formatCurrency(freightUnit)}</td> : null}
                                {showBillingCustomsColumn ? <td>{formatCurrency(customsUnit)}</td> : null}
                                {showBillingInlandColumn ? <td>{formatCurrency(inlandUnit)}</td> : null}
                                {showBillingTaxesColumn ? <td>{formatCurrency(taxesUnit)}</td> : null}
                                {showBillingOthersColumn ? <td>{formatCurrency(othersUnit)}</td> : null}
                                <td>{formatCurrency(totalUnitCop)}</td>
                                <td>
                                  <input
                                    className="import-table-input"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={saleInputValue}
                                    placeholder={billingTrmValue > 0 ? "0.00" : "TRM"}
                                    disabled={!isBillingPricingEditable}
                                    onChange={(event) => {
                                      const nextValue = event.target.value;
                                      setBillingSaleOverrides((current) => ({
                                        ...current,
                                        [rowKey]: nextValue,
                                      }));
                                      setHasPendingBillingPricingChanges(true);
                                    }}
                                  />
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={billingVisibleColumnCount} className="empty-table-cell">Selecciona una exportacion para ver el detalle de costos.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="catalog-form-actions inventory-adjustment-actions">
                    <button
                      className="ghost-button invoice-export-button"
                      type="button"
                      onClick={() => void persistBillingInvoicePricing()}
                      disabled={selectedBillingRows.length === 0 || !isBillingPricingEditable}
                    >
                      Guardar precios
                    </button>
                    <button
                      className="submit-button invoice-export-button"
                      type="button"
                      onClick={() => void downloadBillingInvoicePdf()}
                      disabled={selectedBillingRows.length === 0}
                    >
                      Generar factura (PDF)
                    </button>
                    <button
                      className="primary-action-button invoice-export-button"
                      type="button"
                      onClick={() => void downloadBillingInvoiceExcel()}
                      disabled={selectedBillingRows.length === 0}
                    >
                      Generar factura (Excel)
                    </button>
                  </div>
                </div>
              </div>
            </article>
          </section>
        ) : activeSection === "accounting" ? (
          <section className="accounting-layout">
            <div className="accounting-kpi-grid">
              {isLoadingAccounting
                ? Array.from({ length: 4 }, (_, index) => <article key={index} className="kpi-card is-loading" />)
                : accountingKpis.map((card) => (
                    <article key={card.label} className={`kpi-card tone-${card.tone}`}>
                      <p>{card.label}</p>
                      <strong>
                        {card.label.includes("Costo") || card.label.includes("Gastos")
                          ? formatCurrency(card.value)
                          : card.value}
                      </strong>
                    </article>
                  ))}
            </div>

            {accountingError ? <p className="form-feedback error">{accountingError}</p> : null}

            <article className="database-card">
              <div className="accounting-block-header">
                <div>
                  <p className="section-label">Operaciones Col</p>
                  <h2>Contabilidad mensual (COP)</h2>
                  <p>Filtra por mes para ver exportaciones detalladas, costos adicionales y utilidad estimada en COP.</p>
                </div>
              </div>

              <div className="filter-grid">
                <label className="field">
                  <span>Mes</span>
                  <input
                    type="month"
                    value={accountingMonthFilter}
                    onChange={(event) => setAccountingMonthFilter(event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Utilidad neta facturada (COP)</span>
                  <input type="text" readOnly value={formatCurrency(monthlyProjectedNetUtilityCop)} />
                </label>
              </div>

              <div className="accounting-kpi-grid">
                <article className="kpi-card tone-cyan">
                  <p>Exportaciones del mes</p>
                  <strong>{monthlyImportBatchCount}</strong>
                </article>
                <article className="kpi-card tone-amber">
                  <p>Costo importado del mes (COP)</p>
                  <strong>{formatCurrency(monthlyImportCostTotal)}</strong>
                </article>
                <article className="kpi-card tone-slate">
                  <p>Utilidad bruta facturada (COP)</p>
                  <strong>{formatCurrency(monthlyProjectedUtilityCop)}</strong>
                </article>
                <article className="kpi-card tone-cyan">
                  <p>Costos adicionales del mes (COP)</p>
                  <strong>{formatCurrency(monthlyAdditionalCostsTotal)}</strong>
                </article>
              </div>

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Contenedor</th>
                      <th>Envio</th>
                      <th>Cantidad</th>
                      <th>Costo total (COP)</th>
                      <th>Venta facturada total (COP)</th>
                      <th>Utilidad facturada total (COP)</th>
                      <th>Accion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingAccounting ? (
                      <tr>
                        <td colSpan={8} className="empty-table-cell">Cargando contabilidad mensual...</td>
                      </tr>
                    ) : monthlyImportBatchRows.length > 0 ? (
                      monthlyImportBatchRows.map((row) => {

                        return (
                          <tr key={row.key}>
                            <td>{String(row.importDate).slice(0, 10)}</td>
                            <td>{row.containerReference ? `${formatContainerSize(row.containerSize)} · ${row.containerReference}` : formatContainerSize(row.containerSize)}</td>
                            <td>{row.shipmentReference || "-"}</td>
                            <td>{row.totalQuantity}</td>
                            <td>{formatCurrency(row.totalImportCost)}</td>
                            <td>{formatCurrency(row.totalProjectedRevenue)}</td>
                            <td>{formatCurrency(row.totalProjectedUtility)}</td>
                            <td>
                              <button
                                className="table-action-icon"
                                type="button"
                                aria-label="Ver detalle de productos importados"
                                title="Ver listado"
                                onClick={() => setSelectedAccountingMonthlyBatchKey(row.key)}
                              >
                                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                                  <path d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z" fill="currentColor" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={8} className="empty-table-cell">No hay exportaciones registradas para el mes seleccionado.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <p className="management-table-meta">
                {`Unidades importadas en el mes: ${monthlyImportUnits} · Venta facturada del mes: ${formatCurrency(monthlyProjectedRevenueCop)}`}
              </p>
            </article>

            {selectedAccountingMonthlyBatch ? (
              <div className="modal-overlay" role="presentation" onClick={() => setSelectedAccountingMonthlyBatchKey("")}>
                <div className="modal-card inventory-entry-history-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
                  <div className="modal-header">
                    <div>
                      <p className="section-label">Detalle de exportacion</p>
                      <h2>{selectedAccountingMonthlyBatch.containerReference ? `${formatContainerSize(selectedAccountingMonthlyBatch.containerSize)} · ${selectedAccountingMonthlyBatch.containerReference}` : formatContainerSize(selectedAccountingMonthlyBatch.containerSize)}</h2>
                      <p>{`${String(selectedAccountingMonthlyBatch.importDate).slice(0, 10)} · ${selectedAccountingMonthlyBatch.shipmentReference || "Sin envio"}`}</p>
                    </div>
                    <button className="modal-close-button" type="button" onClick={() => setSelectedAccountingMonthlyBatchKey("")}>Cerrar</button>
                  </div>

                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Contenedor</th>
                          <th>Envio</th>
                          <th>Producto</th>
                          <th>Cantidad</th>
                          <th>Costo unitario (COP)</th>
                          <th>Costo total (COP)</th>
                          <th>Venta facturada (COP)</th>
                          <th>Utilidad facturada (COP)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedAccountingMonthlyBatch.items.map((item, index) => {
                          const itemTotalCost = Number(item.totalImportCost ?? 0);
                          const itemInvoicedRevenue = Number(item.invoicedLineTotalCop ?? 0) > 0
                            ? Number(item.invoicedLineTotalCop ?? 0)
                            : itemTotalCost;
                          const itemInvoicedUtility = Number(item.invoicedLineUtilityCop ?? 0);
                          const key = item._id ?? `${item.productId}-${item.importDate}-${index}`;

                          return (
                            <tr key={key}>
                              <td>{String(item.importDate).slice(0, 10)}</td>
                              <td>{item.containerReference ? `${formatContainerSize(item.containerSize ?? "20ft")} · ${item.containerReference}` : formatContainerSize(item.containerSize ?? "20ft")}</td>
                              <td>{item.shipmentReference || "-"}</td>
                              <td>{`${item.productName} (${item.productSku})`}</td>
                              <td>{item.importedQuantity}</td>
                              <td>{formatCurrency(item.landedUnitCost)}</td>
                              <td>{formatCurrency(itemTotalCost)}</td>
                              <td>{formatCurrency(itemInvoicedRevenue)}</td>
                              <td>{formatCurrency(itemInvoicedUtility)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : null}

            <article className="database-card">
              <div className="accounting-block-header">
                <div>
                  <p className="section-label">Costos fijos</p>
                  <h2>Estructura fija del negocio</h2>
                  <p>Registra nomina, arriendo y otros costos base para entender la carga fija mensual.</p>
                </div>
                <button className="primary-action-button" type="button" onClick={() => setAccountingModalKind("fixed-cost")}>Crear costo fijo</button>
              </div>

              <div className="filter-grid">
                <label className="field">
                  <span>Busqueda general</span>
                  <input
                    type="text"
                    value={fixedCostFilters.search}
                    placeholder="Buscar por concepto"
                    onInput={(event) => handleAccountingFilterChange("fixedCosts", "search", event.currentTarget.value)}
                    onChange={(event) => handleAccountingFilterChange("fixedCosts", "search", event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Categoria</span>
                  <input
                    type="text"
                    value={fixedCostFilters.primary}
                    placeholder="Filtrar por categoria"
                    onInput={(event) => handleAccountingFilterChange("fixedCosts", "primary", event.currentTarget.value)}
                    onChange={(event) => handleAccountingFilterChange("fixedCosts", "primary", event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Frecuencia</span>
                  <input
                    type="text"
                    value={fixedCostFilters.secondary}
                    placeholder="Filtrar por frecuencia"
                    onInput={(event) => handleAccountingFilterChange("fixedCosts", "secondary", event.currentTarget.value)}
                    onChange={(event) => handleAccountingFilterChange("fixedCosts", "secondary", event.target.value)}
                  />
                </label>
              </div>

              {accountingStatuses.fixedCosts ? <p className={`form-feedback ${accountingStatuses.fixedCosts.tone}`}>{accountingStatuses.fixedCosts.message}</p> : null}

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Concepto</th>
                      <th>Categoria</th>
                      <th>Frecuencia</th>
                      <th>Monto</th>
                      <th>Base mensual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingAccounting ? (
                      <tr>
                        <td colSpan={5} className="empty-table-cell">Cargando costos fijos...</td>
                      </tr>
                    ) : filteredFixedCostRows.length > 0 ? (
                      filteredFixedCostRows.map((row) => (
                        <tr key={row._id ?? `${row.name}-${row.startDate}`}>
                          <td>{row.name}</td>
                          <td>{row.category}</td>
                          <td>{row.frequency}</td>
                          <td>{formatCurrency(row.amount)}</td>
                          <td>{formatCurrency(normalizeMonthlyAmount(row.amount, row.frequency))}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="empty-table-cell">Aun no hay costos fijos registrados.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="database-card">
              <div className="accounting-block-header">
                <div>
                  <p className="section-label">Gastos operacionales</p>
                  <h2>Variables del dia a dia</h2>
                  <p>Captura combustible, imprevistos y otros gastos variables que afectan la operacion.</p>
                </div>
                <button className="primary-action-button" type="button" onClick={() => setAccountingModalKind("operational-expense")}>Crear gasto</button>
              </div>

              <div className="filter-grid">
                <label className="field">
                  <span>Busqueda general</span>
                  <input
                    type="text"
                    value={operationalExpenseFilters.search}
                    placeholder="Buscar por concepto"
                    onInput={(event) => handleAccountingFilterChange("operationalExpenses", "search", event.currentTarget.value)}
                    onChange={(event) => handleAccountingFilterChange("operationalExpenses", "search", event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Categoria</span>
                  <input
                    type="text"
                    value={operationalExpenseFilters.primary}
                    placeholder="Filtrar por categoria"
                    onInput={(event) => handleAccountingFilterChange("operationalExpenses", "primary", event.currentTarget.value)}
                    onChange={(event) => handleAccountingFilterChange("operationalExpenses", "primary", event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Mes</span>
                  <input
                    type="text"
                    value={operationalExpenseFilters.secondary}
                    placeholder="YYYY-MM"
                    onInput={(event) => handleAccountingFilterChange("operationalExpenses", "secondary", event.currentTarget.value)}
                    onChange={(event) => handleAccountingFilterChange("operationalExpenses", "secondary", event.target.value)}
                  />
                </label>
              </div>

              {accountingStatuses.operationalExpenses ? <p className={`form-feedback ${accountingStatuses.operationalExpenses.tone}`}>{accountingStatuses.operationalExpenses.message}</p> : null}

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Concepto</th>
                      <th>Categoria</th>
                      <th>Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingAccounting ? (
                      <tr>
                        <td colSpan={4} className="empty-table-cell">Cargando gastos operacionales...</td>
                      </tr>
                    ) : filteredOperationalExpenseRows.length > 0 ? (
                      filteredOperationalExpenseRows.map((row) => (
                        <tr key={row._id ?? `${row.name}-${row.expenseDate}`}>
                          <td>{String(row.expenseDate).slice(0, 10)}</td>
                          <td>{row.name}</td>
                          <td>{row.category}</td>
                          <td>{formatCurrency(row.amount)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="empty-table-cell">Aun no hay gastos operacionales registrados.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        ) : activeSection === "logistics-accounting" ? (
          <section className="accounting-layout">
            {logisticsAccountingError ? <p className="form-feedback error">{logisticsAccountingError}</p> : null}

            <article className="database-card">
              <div className="accounting-block-header">
                <div>
                  <p className="section-label">Logistica</p>
                  <h2>Contabilidad mensual (AWG)</h2>
                  <p>Facturas despachadas a clientes segun catalogo, con utilidad en florines.</p>
                </div>
                <button className="primary-action-button" type="button" onClick={() => {
                  setLogisticsInvoiceForm(createInitialLogisticsInvoiceForm());
                  setLogisticsAccountingModalKind("logistics-invoice");
                }}>Registrar factura</button>
              </div>

              <div className="filter-grid">
                <label className="field">
                  <span>Mes</span>
                  <input
                    type="month"
                    value={logisticsAccountingMonthFilter}
                    onChange={(event) => setLogisticsAccountingMonthFilter(event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Utilidad neta del mes (AWG)</span>
                  <input type="text" readOnly value={formatAwgCurrency(logisticsMonthlyNetUtility)} />
                </label>
              </div>

              <div className="accounting-kpi-grid">
                <article className="kpi-card tone-slate">
                  <p>Pedidos facturados del mes</p>
                  <strong>{logisticsMonthlyBilledOrders.length}</strong>
                </article>
                <article className="kpi-card tone-cyan">
                  <p>Facturas del mes</p>
                  <strong>{logisticsMonthlyInvoices.length}</strong>
                </article>
                <article className="kpi-card tone-amber">
                  <p>Ingresos del mes (AWG)</p>
                  <strong>{formatAwgCurrency(logisticsMonthlyRevenue)}</strong>
                </article>
                <article className="kpi-card tone-slate">
                  <p>Utilidad bruta del mes (AWG)</p>
                  <strong>{formatAwgCurrency(logisticsMonthlyUtility)}</strong>
                </article>
                <article className="kpi-card tone-cyan">
                  <p>Costos adicionales del mes (AWG)</p>
                  <strong>{formatAwgCurrency(logisticsMonthlyAdditionalCosts)}</strong>
                </article>
              </div>

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Cliente</th>
                      <th>Costo total (AWG)</th>
                      <th>Venta total (AWG)</th>
                      <th>Utilidad total (AWG)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingLogisticsAccounting ? (
                      <tr>
                        <td colSpan={5} className="empty-table-cell">Cargando pedidos facturados...</td>
                      </tr>
                    ) : logisticsMonthlyBilledOrders.length > 0 ? (
                      logisticsMonthlyBilledOrders.map((order) => (
                        <tr key={order._id ?? order.orderId}>
                          <td>{String(order.invoiceDate).slice(0, 10)}</td>
                          <td>{order.storeName}</td>
                          <td>{formatAwgCurrency(order.totalCostAwg)}</td>
                          <td>{formatAwgCurrency(order.totalRevenueAwg)}</td>
                          <td>{formatAwgCurrency(order.totalUtilityAwg)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="empty-table-cell">No hay pedidos facturados para el mes seleccionado.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Cliente</th>
                      <th>Vendedor</th>
                      <th>Ruta</th>
                      <th>Costo (AWG)</th>
                      <th>Ingresos (AWG)</th>
                      <th>Utilidad (AWG)</th>
                      <th>Accion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingLogisticsAccounting ? (
                      <tr>
                        <td colSpan={8} className="empty-table-cell">Cargando facturas...</td>
                      </tr>
                    ) : logisticsMonthlyInvoices.length > 0 ? (
                      logisticsMonthlyInvoices.map((inv) => (
                        <tr key={inv._id ?? `${inv.storeName}-${inv.invoiceDate}`}>
                          <td>{String(inv.invoiceDate).slice(0, 10)}</td>
                          <td>{inv.storeName}</td>
                          <td>{inv.salesRepName || "-"}</td>
                          <td>{inv.routeName || "-"}</td>
                          <td>{formatAwgCurrency(inv.totalCostAwg)}</td>
                          <td>{formatAwgCurrency(inv.totalRevenueAwg)}</td>
                          <td>{formatAwgCurrency(inv.totalUtilityAwg)}</td>
                          <td>
                            <button
                              className="table-action-icon"
                              type="button"
                              aria-label="Ver detalle de factura"
                              title="Ver detalle"
                              onClick={() => setSelectedLogisticsInvoiceId(inv._id ?? null)}
                            >
                              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                                <path d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z" fill="currentColor" />
                              </svg>
                            </button>
                            <button
                              className="table-action-icon"
                              type="button"
                              aria-label="Eliminar factura"
                              title="Eliminar"
                              onClick={() => void handleDeleteLogisticsInvoice(inv._id ?? "")}
                            >
                              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="currentColor" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="empty-table-cell">No hay facturas registradas para el mes seleccionado.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            {selectedLogisticsInvoice ? (
              <div className="modal-overlay" role="presentation" onClick={() => setSelectedLogisticsInvoiceId(null)}>
                <div className="modal-card inventory-entry-history-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
                  <div className="modal-header">
                    <div>
                      <p className="section-label">Detalle de factura logistica</p>
                      <h2>{selectedLogisticsInvoice.storeName}</h2>
                      <p>{String(selectedLogisticsInvoice.invoiceDate).slice(0, 10)}{selectedLogisticsInvoice.routeName ? ` · ${selectedLogisticsInvoice.routeName}` : ""}</p>
                    </div>
                    <button className="modal-close-button" type="button" onClick={() => setSelectedLogisticsInvoiceId(null)}>Cerrar</button>
                  </div>
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>SKU</th>
                          <th>Producto</th>
                          <th>Cantidad</th>
                          <th>Precio unitario (AWG)</th>
                          <th>Total linea (AWG)</th>
                          <th>Utilidad linea (AWG)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedLogisticsInvoice.items.map((item, idx) => (
                          <tr key={`${selectedLogisticsInvoice._id}-${item.productId}-${idx}`}>
                            <td>{item.productSku || "-"}</td>
                            <td>{item.productName}</td>
                            <td>{item.quantity}</td>
                            <td>{formatAwgCurrency(item.salePriceAwg)}</td>
                            <td>{formatAwgCurrency(item.lineTotalAwg)}</td>
                            <td>{formatAwgCurrency(item.lineUtilityAwg)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="management-table-meta">
                    {`Total ingresos: ${formatAwgCurrency(selectedLogisticsInvoice.totalRevenueAwg)} · Utilidad bruta: ${formatAwgCurrency(selectedLogisticsInvoice.totalUtilityAwg)}`}
                  </p>
                </div>
              </div>
            ) : null}

            <article className="database-card">
              <div className="accounting-block-header">
                <div>
                  <p className="section-label">Costos fijos</p>
                  <h2>Estructura fija de logistica</h2>
                  <p>Registra nomina, arriendo y otros costos base de la operacion logistica.</p>
                </div>
                <button className="primary-action-button" type="button" onClick={() => setLogisticsAccountingModalKind("logistics-fixed-cost")}>Crear costo fijo</button>
              </div>

              {logisticsAccountingStatuses["fixedCosts"] ? <p className={`form-feedback ${logisticsAccountingStatuses["fixedCosts"].tone}`}>{logisticsAccountingStatuses["fixedCosts"].message}</p> : null}

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Concepto</th>
                      <th>Categoria</th>
                      <th>Frecuencia</th>
                      <th>Monto (AWG)</th>
                      <th>Base mensual (AWG)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingLogisticsAccounting ? (
                      <tr><td colSpan={5} className="empty-table-cell">Cargando costos fijos...</td></tr>
                    ) : logisticsFixedCosts.length > 0 ? (
                      logisticsFixedCosts.map((row) => (
                        <tr key={row._id ?? `${row.name}-${row.startDate}`}>
                          <td>{row.name}</td>
                          <td>{row.category}</td>
                          <td>{row.frequency}</td>
                          <td>{formatAwgCurrency(row.amountAwg)}</td>
                          <td>{formatAwgCurrency(normalizeMonthlyAmount(row.amountAwg, row.frequency))}</td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={5} className="empty-table-cell">Aun no hay costos fijos registrados.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="database-card">
              <div className="accounting-block-header">
                <div>
                  <p className="section-label">Gastos operacionales</p>
                  <h2>Variables del dia a dia</h2>
                  <p>Captura combustible, imprevistos y otros gastos variables de la operacion logistica.</p>
                </div>
                <button className="primary-action-button" type="button" onClick={() => setLogisticsAccountingModalKind("logistics-expense")}>Crear gasto</button>
              </div>

              {logisticsAccountingStatuses["expenses"] ? <p className={`form-feedback ${logisticsAccountingStatuses["expenses"].tone}`}>{logisticsAccountingStatuses["expenses"].message}</p> : null}

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Concepto</th>
                      <th>Categoria</th>
                      <th>Monto (AWG)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingLogisticsAccounting ? (
                      <tr><td colSpan={4} className="empty-table-cell">Cargando gastos...</td></tr>
                    ) : logisticsExpenses.length > 0 ? (
                      logisticsExpenses.map((row) => (
                        <tr key={row._id ?? `${row.name}-${row.expenseDate}`}>
                          <td>{String(row.expenseDate).slice(0, 10)}</td>
                          <td>{row.name}</td>
                          <td>{row.category}</td>
                          <td>{formatAwgCurrency(row.amountAwg)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={4} className="empty-table-cell">Aun no hay gastos registrados.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            {logisticsAccountingModalKind === "logistics-invoice" ? (
              <div className="modal-overlay" role="presentation" onClick={() => setLogisticsAccountingModalKind(null)}>
                <div className="modal-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
                  <div className="modal-header">
                    <div>
                      <p className="section-label">Nueva factura logistica</p>
                      <h2>Registrar pedido despachado</h2>
                      <p>Ingresa el cliente, productos y precio de venta en AWG.</p>
                    </div>
                    <button className="modal-close-button" type="button" onClick={() => setLogisticsAccountingModalKind(null)}>Cerrar</button>
                  </div>
                  <form className="creation-form" onSubmit={(event) => void handleCreateLogisticsInvoice(event)}>
                    <label className="field field-full">
                      <span>Cliente (tienda)</span>
                      <input
                        type="text"
                        value={logisticsInvoiceForm.storeName}
                        placeholder="Nombre del cliente"
                        onChange={(event) => setLogisticsInvoiceForm((f) => ({ ...f, storeName: event.target.value }))}
                        required
                      />
                    </label>
                    <label className="field">
                      <span>Vendedor</span>
                      <input
                        type="text"
                        value={logisticsInvoiceForm.salesRepName}
                        placeholder="Nombre del vendedor"
                        onChange={(event) => setLogisticsInvoiceForm((f) => ({ ...f, salesRepName: event.target.value }))}
                      />
                    </label>
                    <label className="field">
                      <span>Ruta</span>
                      <input
                        type="text"
                        value={logisticsInvoiceForm.routeName}
                        placeholder="Nombre de la ruta"
                        onChange={(event) => setLogisticsInvoiceForm((f) => ({ ...f, routeName: event.target.value }))}
                      />
                    </label>
                    <label className="field">
                      <span>Fecha</span>
                      <input
                        type="date"
                        value={logisticsInvoiceForm.invoiceDate}
                        onChange={(event) => setLogisticsInvoiceForm((f) => ({ ...f, invoiceDate: event.target.value }))}
                        required
                      />
                    </label>
                    <div className="form-span-full">
                      <div className="accounting-block-header" style={{ marginBottom: "0.75rem" }}>
                        <p className="section-label">Productos</p>
                        <button
                          className="secondary-action-button"
                          type="button"
                          onClick={() => setLogisticsInvoiceForm((f) => ({
                            ...f,
                            items: [...f.items, { productId: "", productName: "", productSku: "", quantity: "", salePriceAwg: "", unitCostAwg: "" }],
                          }))}
                        >
                          + Agregar producto
                        </button>
                      </div>
                      {logisticsInvoiceForm.items.map((item, idx) => (
                        <div key={idx} className="filter-grid" style={{ alignItems: "flex-end", marginBottom: "0.5rem" }}>
                          <label className="field">
                            <span>Producto</span>
                            <input
                              type="text"
                              value={item.productName}
                              placeholder="Nombre del producto"
                              onChange={(event) => {
                                const val = event.target.value;
                                setLogisticsInvoiceForm((f) => {
                                  const items = [...f.items];
                                  items[idx] = { ...items[idx], productName: val };
                                  return { ...f, items };
                                });
                              }}
                              required
                            />
                          </label>
                          <label className="field">
                            <span>SKU</span>
                            <input
                              type="text"
                              value={item.productSku}
                              placeholder="SKU"
                              onChange={(event) => {
                                const val = event.target.value;
                                setLogisticsInvoiceForm((f) => {
                                  const items = [...f.items];
                                  items[idx] = { ...items[idx], productSku: val };
                                  return { ...f, items };
                                });
                              }}
                            />
                          </label>
                          <label className="field">
                            <span>Cantidad</span>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={item.quantity}
                              placeholder="0"
                              onChange={(event) => {
                                const val = event.target.value;
                                setLogisticsInvoiceForm((f) => {
                                  const items = [...f.items];
                                  items[idx] = { ...items[idx], quantity: val };
                                  return { ...f, items };
                                });
                              }}
                              required
                            />
                          </label>
                          <label className="field">
                            <span>Precio venta AWG</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.salePriceAwg}
                              placeholder="0.00"
                              onChange={(event) => {
                                const val = event.target.value;
                                setLogisticsInvoiceForm((f) => {
                                  const items = [...f.items];
                                  items[idx] = { ...items[idx], salePriceAwg: val };
                                  return { ...f, items };
                                });
                              }}
                              required
                            />
                          </label>
                          <label className="field">
                            <span>Costo unitario AWG</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unitCostAwg}
                              placeholder="0.00"
                              onChange={(event) => {
                                const val = event.target.value;
                                setLogisticsInvoiceForm((f) => {
                                  const items = [...f.items];
                                  items[idx] = { ...items[idx], unitCostAwg: val };
                                  return { ...f, items };
                                });
                              }}
                            />
                          </label>
                          {logisticsInvoiceForm.items.length > 1 ? (
                            <button
                              className="table-action-icon"
                              type="button"
                              onClick={() => setLogisticsInvoiceForm((f) => ({
                                ...f,
                                items: f.items.filter((_, i) => i !== idx),
                              }))}
                            >
                              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="currentColor" />
                              </svg>
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    <label className="field field-full">
                      <span>Notas</span>
                      <input
                        type="text"
                        value={logisticsInvoiceForm.notes}
                        placeholder="Notas opcionales"
                        onChange={(event) => setLogisticsInvoiceForm((f) => ({ ...f, notes: event.target.value }))}
                      />
                    </label>
                    {logisticsAccountingStatuses["invoice"] ? (
                      <p className={`form-feedback ${logisticsAccountingStatuses["invoice"].tone} form-span-full`}>{logisticsAccountingStatuses["invoice"].message}</p>
                    ) : null}
                    <div className="form-actions form-span-full">
                      <button className="primary-action-button" type="submit">Registrar factura</button>
                    </div>
                  </form>
                </div>
              </div>
            ) : logisticsAccountingModalKind === "logistics-fixed-cost" ? (
              <div className="modal-overlay" role="presentation" onClick={() => setLogisticsAccountingModalKind(null)}>
                <div className="modal-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
                  <div className="modal-header">
                    <div>
                      <p className="section-label">Costos fijos</p>
                      <h2>Nuevo costo fijo logistico</h2>
                    </div>
                    <button className="modal-close-button" type="button" onClick={() => setLogisticsAccountingModalKind(null)}>Cerrar</button>
                  </div>
                  <form className="creation-form" onSubmit={(event) => void handleCreateLogisticsFixedCost(event)}>
                    <label className="field field-full">
                      <span>Concepto</span>
                      <input type="text" name="name" placeholder="Nomina, arriendo..." required />
                    </label>
                    <label className="field">
                      <span>Categoria</span>
                      <select name="category" required>
                        {fixedCostCategoryOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                    </label>
                    <label className="field">
                      <span>Frecuencia</span>
                      <select name="frequency" required>
                        {fixedCostFrequencyOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                    </label>
                    <label className="field">
                      <span>Monto (AWG)</span>
                      <input type="number" name="amountAwg" min="0" step="0.01" placeholder="0.00" required />
                    </label>
                    <label className="field">
                      <span>Fecha inicio</span>
                      <input type="date" name="startDate" required />
                    </label>
                    <label className="field field-full">
                      <span>Notas</span>
                      <input type="text" name="notes" placeholder="Notas opcionales" />
                    </label>
                    {logisticsAccountingStatuses["fixedCosts"] ? (
                      <p className={`form-feedback ${logisticsAccountingStatuses["fixedCosts"].tone} form-span-full`}>{logisticsAccountingStatuses["fixedCosts"].message}</p>
                    ) : null}
                    <div className="form-actions form-span-full">
                      <button className="primary-action-button" type="submit">Crear costo fijo</button>
                    </div>
                  </form>
                </div>
              </div>
            ) : logisticsAccountingModalKind === "logistics-expense" ? (
              <div className="modal-overlay" role="presentation" onClick={() => setLogisticsAccountingModalKind(null)}>
                <div className="modal-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
                  <div className="modal-header">
                    <div>
                      <p className="section-label">Gastos operacionales</p>
                      <h2>Nuevo gasto logistico</h2>
                    </div>
                    <button className="modal-close-button" type="button" onClick={() => setLogisticsAccountingModalKind(null)}>Cerrar</button>
                  </div>
                  <form className="creation-form" onSubmit={(event) => void handleCreateLogisticsExpense(event)}>
                    <label className="field field-full">
                      <span>Concepto</span>
                      <input type="text" name="name" placeholder="Combustible, imprevisto..." required />
                    </label>
                    <label className="field">
                      <span>Categoria</span>
                      <select name="category" required>
                        {[
                          { value: "fuel", label: "Combustible" },
                          { value: "maintenance", label: "Mantenimiento" },
                          { value: "unforeseen", label: "Imprevisto" },
                          { value: "delivery", label: "Despacho" },
                          { value: "tolls", label: "Peajes" },
                          { value: "other", label: "Otro" },
                        ].map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                    </label>
                    <label className="field">
                      <span>Monto (AWG)</span>
                      <input type="number" name="amountAwg" min="0" step="0.01" placeholder="0.00" required />
                    </label>
                    <label className="field">
                      <span>Fecha</span>
                      <input type="date" name="expenseDate" required />
                    </label>
                    <label className="field field-full">
                      <span>Notas</span>
                      <input type="text" name="notes" placeholder="Notas opcionales" />
                    </label>
                    {logisticsAccountingStatuses["expenses"] ? (
                      <p className={`form-feedback ${logisticsAccountingStatuses["expenses"].tone} form-span-full`}>{logisticsAccountingStatuses["expenses"].message}</p>
                    ) : null}
                    <div className="form-actions form-span-full">
                      <button className="primary-action-button" type="submit">Crear gasto</button>
                    </div>
                  </form>
                </div>
              </div>
            ) : null}
          </section>
        ) : activeSection === "routes" ? (
          <section className="routes-layout">
            <article className="creation-selector-block">
              <p className="section-label">Planeacion semanal</p>
              <h2>Construye la ruta del vendedor</h2>
              <p className="route-helper-text">
                Selecciona el vendedor y marca las tiendas que debe visitar cada dia.
              </p>
            </article>

            <article className="route-builder-card">
              <form className="route-builder-form" onInputCapture={handlePortalInputCapture} onSubmit={(event) => void handleRouteSubmit(event)}>
                <div className="route-form-grid">
                  <label className="field field-full">
                    <span>Nombre de la ruta</span>
                    <input
                      type="text"
                      value={routeForm.name}
                      placeholder="Ruta Norte Aruba"
                      onChange={(event) => handleRouteFieldChange("name", event.target.value)}
                      required
                    />
                  </label>

                  <label className="field field-two-third">
                    <span>Vendedor asignado</span>
                    <select
                      value={routeForm.salesRepId}
                      onChange={(event) => handleRouteFieldChange("salesRepId", event.target.value)}
                      disabled={salesRepOptions.length === 0}
                      required
                    >
                      {salesRepOptions.length === 0 ? <option value="">Primero crea un vendedor Aruba</option> : null}
                      {salesRepOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field field-full">
                    <span>Notas operativas</span>
                    <textarea
                      rows={3}
                      value={routeForm.notes}
                      placeholder="Objetivos, observaciones o prioridades de esta ruta semanal."
                      onChange={(event) => handleRouteFieldChange("notes", event.target.value)}
                    />
                  </label>
                </div>

                <div className="route-days-grid">
                  {routeDayOptions.map((day) => {
                    const assignedStores = routeForm.dayAssignments[day.key];

                    return (
                      <article className="route-day-card" key={day.key}>
                        <div className="route-day-header">
                          <h3>{day.label}</h3>
                          <span>{assignedStores.length} tiendas</span>
                        </div>

                        <div className="route-store-list">
                          {storeOptions.length === 0 ? (
                            <p className="route-empty-state">Primero crea tiendas en la seccion de creaciones.</p>
                          ) : (
                            storeOptions.map((store) => (
                              <label className="route-store-option" key={`${day.key}-${store.value}`}>
                                <input
                                  type="checkbox"
                                  checked={assignedStores.includes(store.value)}
                                  onChange={() => toggleStoreForDay(day.key, store.value)}
                                />
                                <span>
                                  <strong>{store.label}</strong>
                                  <small>{store.address || "Sin direccion"}</small>
                                </span>
                              </label>
                            ))
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>

                {routeStatus ? <p className={`form-feedback ${routeStatus.tone}`}>{routeStatus.message}</p> : null}

                <button
                  className="submit-button"
                  type="submit"
                  disabled={isSavingRoute || salesRepOptions.length === 0 || storeOptions.length === 0}
                >
                  {isSavingRoute ? "Guardando ruta..." : editingRouteId ? "Guardar cambios de la ruta" : "Guardar ruta semanal"}
                </button>

                {editingRouteId ? (
                  <button className="ghost-button" type="button" onClick={resetRouteForm}>
                    Cancelar edicion
                  </button>
                ) : null}
              </form>
            </article>

            <article className="database-card">
              <div className="creation-header database-header">
                <div>
                  <h2>Rutas creadas</h2>
                  <p>Resumen operativo de las rutas vigentes por vendedor y por semana.</p>
                </div>
              </div>

              {routeError ? <p className="form-feedback error">{routeError}</p> : null}

              <div className="routes-summary-list">
                {isLoadingRoutes ? (
                  <article className="route-summary-card is-loading" />
                ) : routes.length > 0 ? (
                  routes.map((route) => (
                    <article className="route-summary-card" key={route._id ?? route.code}>
                      <div className="route-summary-header">
                        <div>
                          <p className="section-label">{route.weekLabel}</p>
                          <h3>{route.name}</h3>
                          <p>{route.salesRepName}</p>
                        </div>
                        <div className="route-summary-metrics">
                          <strong>{route.plannedStops}</strong>
                          <span>tiendas planificadas</span>
                          <div className="table-action-group">
                            <button
                              className="table-action-icon"
                              type="button"
                              aria-label="Modificar ruta"
                              title="Modificar"
                              onClick={() => startRouteEdit(route)}
                            >
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M4 20h4l10-10-4-4L4 16v4zm12.7-12.3 1.6-1.6a1 1 0 0 1 1.4 0l1.2 1.2a1 1 0 0 1 0 1.4L19.3 10l-2.6-2.3z" fill="currentColor" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>

                      <p className="route-summary-days">{formatRouteStoresSummary(route.days)}</p>

                      {route.notes ? <p className="route-summary-notes">{route.notes}</p> : null}
                    </article>
                  ))
                ) : (
                  <p className="route-empty-state">Aun no hay rutas semanales creadas.</p>
                )}
              </div>
            </article>
          </section>
        ) : activeSection === "inventory" ? (
          <section className="database-layout">
            <div className="management-overview">
              <div className="accounting-kpi-grid">
                {isLoadingInventory
                  ? Array.from({ length: 4 }, (_, index) => <article key={index} className="kpi-card is-loading" />)
                  : (
                    <>
                      <article className="kpi-card tone-cyan">
                        <p>Productos en inventario</p>
                        <strong>{inventoryKpis.totalProducts}</strong>
                      </article>
                      <article className="kpi-card tone-amber">
                        <p>Unidades disponibles</p>
                        <strong>{inventoryKpis.totalUnits}</strong>
                      </article>
                      <article className="kpi-card tone-slate">
                        <p>Costo total inventario (AWG)</p>
                        <strong>{formatAwgCurrency(inventoryKpis.totalInventoryCost)}</strong>
                      </article>
                      <button
                        className={`kpi-card kpi-card-button tone-cyan ${inventoryFilter === "expiring-soon" ? "is-active" : ""}`}
                        type="button"
                        onClick={toggleExpiringSoonInventoryFilter}
                      >
                        <p>Prontos a vencerse (2 meses)</p>
                        <strong>{inventoryKpis.expiringSoon}</strong>
                      </button>
                    </>
                  )}
              </div>

              <div className="management-action-panel">
                <p className="section-label">Crear</p>
                <h2>Nuevo registro</h2>
                <p>Abre la pagina de entrada para registrar inventario y cargar archivos Excel.</p>
                <button className="primary-action-button" type="button" onClick={openInventoryEntryPage}>
                  Registrar inventario
                </button>
              </div>
            </div>

                <label className="field inventory-name-filter-field">
                  <span>Filtrar por nombre</span>
                  <input
                    type="text"
                    value={inventoryNameFilter}
                    placeholder="Escribe el nombre del producto"
                    onChange={(event) => setInventoryNameFilter(event.target.value)}
                  />
                </label>

            {inventoryError ? <p className="form-feedback error">{inventoryError}</p> : null}

            <article className="database-card">
              <div className="creation-header database-header">
                <div>
                  <h2>Inventario actual</h2>
                  <p>Resumen por producto con cantidades, costo, venta potencial y fecha de caducidad.</p>
                </div>
                <p className="management-table-meta">
                  {inventoryFilter === "expiring-soon"
                    ? `${filteredInventoryRows.length} proximos a vencer`
                    : `${filteredInventoryRows.length} resultados`}
                </p>
              </div>

              <label className="field inventory-name-filter-field">
                <span>Filtrar por nombre</span>
                <input
                  type="text"
                  value={inventoryNameFilter}
                  placeholder="Escribe el nombre del producto"
                  onChange={(event) => setInventoryNameFilter(event.target.value)}
                />
              </label>

              {inventoryFilter === "expiring-soon" ? (
                <p className="form-feedback success">
                  Mostrando solo productos proximos a vencer. Presiona el card nuevamente para ver todo el inventario.
                </p>
              ) : null}

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Cantidad</th>
                      <th>Costo unitario (AWG)</th>
                      <th>Costo total (AWG)</th>
                      <th>Venta (AWG)</th>
                      <th>Total venta (AWG)</th>
                      <th>Fecha de caducidad</th>
                      <th>Accion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingInventory ? (
                      <tr>
                        <td colSpan={8} className="empty-table-cell">Cargando inventario...</td>
                      </tr>
                    ) : filteredInventoryRows.length > 0 ? (
                      filteredInventoryRows.map((row) => (
                        <tr key={row.productId}>
                          <td>{`${row.name} (${row.sku})`}</td>
                          <td>{row.quantity}</td>
                          <td>{formatCurrencyUpTwoDecimals(row.unitCost)}</td>
                          <td>{formatCurrencyUpTwoDecimals(row.totalCost)}</td>
                          <td>{formatCurrencyUpTwoDecimals(row.salePrice)}</td>
                          <td>{formatCurrencyUpTwoDecimals(row.totalSale)}</td>
                          <td>{row.expirationDate ? String(row.expirationDate).slice(0, 10) : "-"}</td>
                          <td>
                            <div className="table-action-group">
                              <button
                                className="table-action-icon"
                                type="button"
                                aria-label="Sacar unidades del inventario"
                                title="Sacar unidades"
                                onClick={() => openInventoryAdjustmentModal(row)}
                                disabled={row.quantity <= 0}
                              >
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                  <path d="M4 20h4l10-10-4-4L4 16v4zm12.7-12.3 1.6-1.6a1 1 0 0 1 1.4 0l1.2 1.2a1 1 0 0 1 0 1.4L19.3 10l-2.6-2.3z" fill="currentColor" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="empty-table-cell">
                          {inventoryFilter === "expiring-soon"
                            ? "No hay productos proximos a vencer dentro de los proximos 2 meses."
                            : "Aun no hay inventario registrado."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="database-card">
              <div className="creation-header database-header">
                <div>
                  <h2>Historial de inventario</h2>
                  <p>Registro de entradas y salidas para trazabilidad de vencidos y demas movimientos.</p>
                </div>
                <p className="management-table-meta">{inventoryHistoryRows.length} movimientos</p>
              </div>

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Producto</th>
                      <th>Movimiento</th>
                      <th>Cantidad</th>
                      <th>Motivo</th>
                      <th>Fuente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventoryHistoryRows.length > 0 ? (
                      inventoryHistoryRows.map((row) => (
                        <tr key={`inventory-history-${row.id}`}>
                          <td>{String(row.createdAt).slice(0, 10)}</td>
                          <td>{`${row.productName} (${row.productSku})`}</td>
                          <td>{row.movementType === "entry" ? "Entrada" : "Salida"}</td>
                          <td>{row.quantity}</td>
                          <td>{row.reason || "-"}</td>
                          <td>{row.source || "-"}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="empty-table-cell">Aun no hay movimientos en el historial de inventario.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            {selectedInventoryAdjustmentRow ? (
              <div className="modal-overlay" role="presentation" onClick={closeInventoryAdjustmentModal}>
                <div className="modal-card inventory-adjustment-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
                  <div className="modal-header">
                    <div>
                      <p className="section-label">Salida de inventario</p>
                      <h2>{`${selectedInventoryAdjustmentRow.name} (${selectedInventoryAdjustmentRow.sku})`}</h2>
                      <p>Registra cuantas unidades van a salir del inventario y el motivo de la salida.</p>
                    </div>
                    <button className="modal-close-button" type="button" onClick={closeInventoryAdjustmentModal}>Cerrar</button>
                  </div>

                  <div className="inventory-cost-summary-grid inventory-adjustment-summary-grid">
                    <div className="import-summary-card">
                      <p>Unidades disponibles</p>
                      <strong>{selectedInventoryAdjustmentRow.quantity}</strong>
                    </div>
                    <div className="import-summary-card">
                      <p>Fecha de caducidad</p>
                      <strong>{selectedInventoryAdjustmentRow.expirationDate ? String(selectedInventoryAdjustmentRow.expirationDate).slice(0, 10) : "-"}</strong>
                    </div>
                  </div>

                  <form className="inventory-adjustment-form" onSubmit={handleInventoryAdjustmentSubmit}>
                    <div className="inventory-adjustment-grid">
                      <label className="field">
                        <span>Cantidad a sacar</span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={inventoryAdjustmentForm.quantity}
                          placeholder="10"
                          onChange={(event) =>
                            setInventoryAdjustmentForm((current) => ({ ...current, quantity: event.target.value }))
                          }
                        />
                      </label>

                      <label className="field">
                        <span>Motivo</span>
                        <select
                          value={inventoryAdjustmentForm.reason}
                          onChange={(event) =>
                            setInventoryAdjustmentForm((current) => ({ ...current, reason: event.target.value }))
                          }
                        >
                          <option value="">Selecciona un motivo</option>
                          {inventoryAdjustmentReasonOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </label>

                      <label className="field inventory-adjustment-notes">
                        <span>Detalle adicional</span>
                        <textarea
                          rows={4}
                          value={inventoryAdjustmentForm.notes}
                          placeholder="Ejemplo: 12 unidades vencidas detectadas en inspeccion interna."
                          onChange={(event) =>
                            setInventoryAdjustmentForm((current) => ({ ...current, notes: event.target.value }))
                          }
                        />
                      </label>
                    </div>

                    {inventoryAdjustmentStatus ? (
                      <p className={`form-feedback ${inventoryAdjustmentStatus.tone === "error" ? "error" : "success"}`}>
                        {inventoryAdjustmentStatus.message}
                      </p>
                    ) : null}

                    <div className="catalog-form-actions inventory-adjustment-actions">
                      <button className="ghost-button" type="button" onClick={closeInventoryAdjustmentModal}>
                        Cancelar
                      </button>
                      <button className="submit-button" type="submit" disabled={isSavingInventoryAdjustment}>
                        {isSavingInventoryAdjustment ? "Guardando salida..." : "Guardar salida"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            ) : null}

            {isInventoryEntryModalOpen ? (
              <div className="modal-overlay" role="presentation" onClick={closeInventoryEntryModal}>
                <div className="modal-card inventory-entry-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
                  <div className="modal-header">
                    <div>
                      <p className="section-label">Entrada de inventario</p>
                      <h2>Registrar inventario</h2>
                      <p>Selecciona los productos que ingresan, define la tasa USD@AWG y revisa el costo convertido en florines.</p>
                    </div>
                    <button className="modal-close-button" type="button" onClick={closeInventoryEntryModal}>Cerrar</button>
                  </div>

                  <form className="inventory-adjustment-form" onSubmit={handleInventoryEntrySubmit}>
                    <div className="inventory-entry-top-grid">
                      <label className="field field-full">
                        <span>Bodega</span>
                        <select
                          value={inventoryEntryWarehouseId}
                          onChange={(event) => setInventoryEntryWarehouseId(event.target.value)}
                          disabled={warehouseOptions.length === 0}
                        >
                          <option value="">Selecciona una bodega</option>
                          {warehouseOptions.map((warehouse) => (
                            <option key={warehouse.value} value={warehouse.value}>{warehouse.label}</option>
                          ))}
                        </select>
                      </label>

                      <label className="field field-full">
                        <span>USD@AWG</span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={inventoryUsdToAwgRate}
                          placeholder="1.79"
                          onChange={(event) => setInventoryUsdToAwgRate(event.target.value)}
                        />
                      </label>
                    </div>

                    <div className="inventory-entry-products">
                      {inventoryEntryItems.map((item, index) => (
                        <article key={item.id} className="inventory-entry-row">
                          <label className="field field-full">
                            <span>{`Producto ${index + 1}`}</span>
                            <select
                              value={item.productId}
                              onChange={(event) => updateInventoryEntryRow(item.id, "productId", event.target.value)}
                            >
                              <option value="">Selecciona un producto</option>
                              {productOptions.map((product) => (
                                <option key={product.value} value={product.value}>{`${product.label} (${product.sku})`}</option>
                              ))}
                            </select>
                          </label>

                          <label className="field field-full">
                            <span>Cantidad</span>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={item.quantity}
                              placeholder="0"
                              onChange={(event) => updateInventoryEntryRow(item.id, "quantity", event.target.value)}
                            />
                          </label>

                          <label className="field field-full">
                            <span>Costo USD total del lote</span>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={item.costUsd}
                              placeholder="0.00"
                              onChange={(event) => updateInventoryEntryRow(item.id, "costUsd", event.target.value)}
                            />
                          </label>

                          <label className="field field-full">
                            <span>Costo AWG total (calculado)</span>
                            <input type="number" readOnly value={getInventoryEntryCostAwg(item.costUsd)} placeholder="0.00" />
                          </label>

                          <button
                            className="ghost-button inventory-entry-remove"
                            type="button"
                            onClick={() => removeInventoryEntryRow(item.id)}
                            disabled={inventoryEntryItems.length <= 1}
                          >
                            Quitar
                          </button>
                        </article>
                      ))}
                    </div>

                    <div className="catalog-form-actions inventory-adjustment-actions">
                      <button className="ghost-button" type="button" onClick={addInventoryEntryRow}>
                        Agregar producto
                      </button>
                    </div>

                    {inventoryEntryStatus ? <p className={`form-feedback ${inventoryEntryStatus.tone}`}>{inventoryEntryStatus.message}</p> : null}

                    <button className="submit-button" type="submit" disabled={isSavingInventoryEntry}>
                      {isSavingInventoryEntry ? "Registrando inventario..." : "Guardar entrada de inventario"}
                    </button>
                  </form>
                </div>
              </div>
            ) : null}
          </section>
        ) : activeSection === "inventory-entry" ? (
          <section className="database-layout">
            <article className="database-card">
              <div className="accounting-block-header">
                <div>
                  <p className="section-label">Entrada de inventario</p>
                  <h2>Registrar inventario</h2>
                  <p>Sube el Excel generado en Facturacion o agrega productos manualmente desde el boton pequeño.</p>
                </div>
                <button className="ghost-button" type="button" onClick={() => setActiveSection("inventory")}>
                  &larr; Volver a inventario
                </button>
              </div>

              <form id="inventory-entry-form" className="inventory-adjustment-form" onSubmit={handleInventoryEntrySubmit}>
                <div className="inventory-entry-top-grid">
                  <label className="field field-full">
                    <span>Bodega</span>
                    <select
                      value={inventoryEntryWarehouseId}
                      onChange={(event) => setInventoryEntryWarehouseId(event.target.value)}
                      disabled={warehouseOptions.length === 0}
                    >
                      <option value="">Selecciona una bodega</option>
                      {warehouseOptions.map((warehouse) => (
                        <option key={warehouse.value} value={warehouse.value}>{warehouse.label}</option>
                      ))}
                    </select>
                  </label>

                  <label className="field field-full">
                    <span>USD@AWG</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={inventoryUsdToAwgRate}
                      placeholder="1.79"
                      onChange={(event) => setInventoryUsdToAwgRate(event.target.value)}
                    />
                  </label>

                  <label className="field field-full">
                    <span>Cargar Excel de facturacion</span>
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        void handleInventoryExcelUpload(file);
                        event.currentTarget.value = "";
                      }}
                    />
                    <small>
                      {isImportingInventoryExcel
                        ? "Importando Excel..."
                        : inventoryExcelFileName
                          ? `Archivo cargado: ${inventoryExcelFileName}`
                          : "Sube el Excel de Facturacion para autocompletar productos."}
                    </small>
                  </label>
                </div>

                {inventoryEntryStatus ? <p className={`form-feedback ${inventoryEntryStatus.tone}`}>{inventoryEntryStatus.message}</p> : null}

              </form>
            </article>

            <article className="database-card">
              <div className="creation-header database-header">
                <div>
                  <h2>Informacion agregada</h2>
                  <p>Vista previa de los productos que se van a registrar en inventario.</p>
                </div>
                <div className="inventory-entry-table-tools">
                  <p className="management-table-meta">{inventoryEntryItems.length} filas</p>
                  <button className="small-add-button" type="button" onClick={openInventoryEntryItemModal}>
                    + Agregar producto
                  </button>
                </div>
              </div>

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Cantidad</th>
                      <th>Costo USD total</th>
                      <th>Costo AWG total</th>
                      <th>Venta AWG/u</th>
                      <th>Peso kg/u</th>
                      <th>Caducidad</th>
                      <th>Accion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventoryEntryItems.length > 0 ? (
                      inventoryEntryItems.map((item) => {
                        const product = productOptions.find((option) => option.value === item.productId);

                        return (
                          <tr key={`preview-${item.id}`}>
                            <td>{product ? `${product.label} (${product.sku})` : "-"}</td>
                            <td>
                              <input
                                className="inventory-entry-inline-input"
                                type="number"
                                min="0"
                                step="1"
                                value={item.quantity}
                                placeholder="0"
                                onChange={(event) => updateInventoryEntryRow(item.id, "quantity", event.target.value)}
                                disabled={isImportingInventoryExcel || isSavingInventoryEntry}
                              />
                            </td>
                            <td>{item.costUsd || "0"}</td>
                            <td>{getInventoryEntryCostAwg(item.costUsd) || "0"}</td>
                            <td>
                              <input
                                className="inventory-entry-inline-input"
                                type="number"
                                min="0"
                                step="any"
                                value={item.salePriceAwg}
                                placeholder="0"
                                onChange={(event) => updateInventoryEntryRow(item.id, "salePriceAwg", event.target.value)}
                                disabled={isImportingInventoryExcel || isSavingInventoryEntry}
                              />
                            </td>
                            <td>
                              <input
                                className="inventory-entry-inline-input"
                                type="number"
                                min="0"
                                step="any"
                                value={item.productWeightKg}
                                placeholder="0"
                                onChange={(event) => updateInventoryEntryRow(item.id, "productWeightKg", event.target.value)}
                                disabled={isImportingInventoryExcel || isSavingInventoryEntry}
                              />
                            </td>
                            <td>
                              <input
                                className="inventory-entry-inline-input"
                                type="date"
                                value={item.expirationDate}
                                onChange={(event) => updateInventoryEntryRow(item.id, "expirationDate", event.target.value)}
                                disabled={isImportingInventoryExcel || isSavingInventoryEntry}
                              />
                            </td>
                            <td>
                              <button
                                className="table-action-icon is-danger"
                                type="button"
                                aria-label="Quitar producto"
                                title="Quitar"
                                onClick={() => removeInventoryEntryRow(item.id)}
                              >
                                x
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={8} className="empty-table-cell">Aun no hay productos agregados.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="inventory-entry-submit-actions">
                <button
                  className="submit-button"
                  type="submit"
                  form="inventory-entry-form"
                  disabled={isSavingInventoryEntry || isImportingInventoryExcel}
                >
                  {isSavingInventoryEntry ? "Registrando inventario..." : "Guardar entrada de inventario"}
                </button>
              </div>
            </article>

            <article className="database-card">
              <div className="creation-header database-header">
                <div>
                  <h2>Historial de inventario agregado</h2>
                  <p>Una fila por cada registro de entrada guardado, agrupando todos sus productos.</p>
                </div>
                <p className="management-table-meta">{inventoryEntryHistoryGroups.length} agregadas</p>
              </div>

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Bodega</th>
                      <th>Productos</th>
                      <th>Unidades</th>
                      <th>USD@AWG</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventoryEntryHistoryGroups.length > 0 ? (
                      inventoryEntryHistoryGroups.map((group) => {
                        const canEditGroup = Number(group.usdToAwgRate || 0) > 0
                          && group.items.every((item) => Number.isFinite(Number(item.entryCostUsd ?? 0)));

                        return (
                          <tr key={`inventory-entry-group-${group.id}`}>
                            <td>{String(group.createdAt).slice(0, 10)}</td>
                            <td>{group.warehouseName || "-"}</td>
                            <td>{group.productCount}</td>
                            <td>{group.totalUnits}</td>
                            <td>{group.usdToAwgRate > 0 ? Number(group.usdToAwgRate).toFixed(2) : "-"}</td>
                            <td>
                              <div className="table-action-group">
                                <button
                                  className="table-action-icon"
                                  type="button"
                                  aria-label="Editar registro de inventario"
                                  title={canEditGroup ? "Editar" : "No editable"}
                                  disabled={!canEditGroup}
                                  onClick={() => loadInventoryEntryHistoryGroupForEdit(group.id)}
                                >
                                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm14.71-9.04a1.003 1.003 0 000-1.42l-2.5-2.5a1.003 1.003 0 00-1.42 0l-1.83 1.83 3.75 3.75 2-1.66z" fill="currentColor" />
                                  </svg>
                                </button>

                                <button
                                  className="table-action-icon"
                                  type="button"
                                  aria-label="Ver detalle del inventario agregado"
                                  title="Ver listado"
                                  onClick={() => openInventoryEntryHistoryGroupDetails(group.id)}
                                >
                                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                                    <path d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z" fill="currentColor" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="empty-table-cell">Aun no hay entradas de inventario registradas.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            {selectedInventoryEntryHistoryGroup ? (
              <div className="modal-overlay" role="presentation" onClick={closeInventoryEntryHistoryGroupDetails}>
                <div className="modal-card inventory-entry-history-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
                  <div className="modal-header">
                    <div>
                      <p className="section-label">Detalle de ingreso</p>
                      <h2>Inventario agregado</h2>
                      <p>
                        {`${selectedInventoryEntryHistoryGroup.productCount} productos · ${selectedInventoryEntryHistoryGroup.totalUnits} unidades · USD@AWG ${Number(selectedInventoryEntryHistoryGroup.usdToAwgRate || 0).toFixed(2)}`}
                      </p>
                    </div>
                    <button className="modal-close-button" type="button" onClick={closeInventoryEntryHistoryGroupDetails}>Cerrar</button>
                  </div>

                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Producto</th>
                          <th>Cantidad</th>
                          <th>Costo USD/u</th>
                          <th>Costo AWG/u</th>
                          <th>Total AWG</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedInventoryEntryHistoryGroup.items.map((item) => {
                          const unitCostUsd = Number(item.entryCostUsd ?? 0);
                          const unitCostAwg = unitCostUsd * Number(selectedInventoryEntryHistoryGroup.usdToAwgRate ?? 0);
                          const totalCostAwg = unitCostAwg * Number(item.quantity ?? 0);

                          return (
                            <tr key={`entry-history-item-${selectedInventoryEntryHistoryGroup.id}-${item.id}`}>
                              <td>{`${item.productName} (${item.productSku})`}</td>
                              <td>{item.quantity}</td>
                              <td>{formatUsdCurrency(unitCostUsd)}</td>
                              <td>{formatCurrencyUpTwoDecimals(unitCostAwg)}</td>
                              <td>{formatCurrencyUpTwoDecimals(totalCostAwg)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : null}

            {isInventoryEntryItemModalOpen ? (
              <div className="modal-overlay" role="presentation" onClick={closeInventoryEntryItemModal}>
                <div className="modal-card inventory-entry-item-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
                  <div className="modal-header">
                    <div>
                      <p className="section-label">Agregar producto</p>
                      <h2>Nuevo producto para tabla</h2>
                      <p>Completa producto, cantidad y costo USD para agregarlo a la tabla.</p>
                    </div>
                    <button className="modal-close-button" type="button" onClick={closeInventoryEntryItemModal}>Cerrar</button>
                  </div>

                  <form className="inventory-adjustment-form" onSubmit={submitInventoryEntryItemModal}>
                    <div className="inventory-entry-item-grid">
                      <label className="field">
                        <span>Producto</span>
                        <select
                          value={inventoryEntryItemDraft.productId}
                          onChange={(event) => {
                            const selectedProduct = productOptions.find((product) => product.value === event.target.value);
                            setInventoryEntryItemDraft((current) => ({
                              ...current,
                              productId: event.target.value,
                              salePriceAwg: current.salePriceAwg || String(selectedProduct?.salePrice ?? ""),
                              productWeightKg: current.productWeightKg || String(selectedProduct?.productWeightKg ?? ""),
                            }));
                          }}
                        >
                          <option value="">Selecciona un producto</option>
                          {productOptions.map((product) => (
                            <option key={product.value} value={product.value}>{`${product.label} (${product.sku})`}</option>
                          ))}
                        </select>
                      </label>

                      <label className="field">
                        <span>Cantidad</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={inventoryEntryItemDraft.quantity}
                          placeholder="0"
                          onChange={(event) => setInventoryEntryItemDraft((current) => ({ ...current, quantity: event.target.value }))}
                        />
                      </label>

                      <label className="field">
                        <span>Costo USD total del lote</span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={inventoryEntryItemDraft.costUsd}
                          placeholder="0.00"
                          onChange={(event) => setInventoryEntryItemDraft((current) => ({ ...current, costUsd: event.target.value }))}
                        />
                      </label>

                      <label className="field">
                        <span>Venta AWG por unidad</span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={inventoryEntryItemDraft.salePriceAwg}
                          placeholder="0.00"
                          onChange={(event) => setInventoryEntryItemDraft((current) => ({ ...current, salePriceAwg: event.target.value }))}
                        />
                      </label>

                      <label className="field">
                        <span>Peso por unidad (kg)</span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={inventoryEntryItemDraft.productWeightKg}
                          placeholder="0.00"
                          onChange={(event) => setInventoryEntryItemDraft((current) => ({ ...current, productWeightKg: event.target.value }))}
                        />
                      </label>

                      <label className="field">
                        <span>Fecha de caducidad</span>
                        <input
                          type="date"
                          value={inventoryEntryItemDraft.expirationDate}
                          onChange={(event) => setInventoryEntryItemDraft((current) => ({ ...current, expirationDate: event.target.value }))}
                        />
                      </label>

                      <label className="field">
                        <span>Costo AWG total (calculado)</span>
                        <input type="number" readOnly value={getInventoryEntryCostAwg(inventoryEntryItemDraft.costUsd)} placeholder="0.00" />
                      </label>
                    </div>

                    <div className="catalog-form-actions inventory-adjustment-actions">
                      <button className="ghost-button" type="button" onClick={closeInventoryEntryItemModal}>Cancelar</button>
                      <button className="submit-button" type="submit">Agregar a la tabla</button>
                    </div>
                  </form>
                </div>
              </div>
            ) : null}
          </section>
        ) : activeSection === "orders" ? (
          <section className="routes-layout">
            <article className="creation-selector-block">
              <p className="section-label">Recepcion</p>
              <h2>Pedidos del equipo comercial</h2>
              <p className="route-helper-text">Aqui aparecen los pedidos enviados por vendedores para revision, preparacion y despacho desde bodega.</p>
            </article>

            <article className="database-card">
              <div className="management-table-header">
                <div>
                  <h2>Pedidos recibidos</h2>
                  <p>Consulta vendedor, cliente, ruta, fecha y detalle de productos por pedido.</p>
                </div>
                <p className="management-table-meta">{warehouseReceivedOrders.length} pedidos</p>
              </div>

              {warehouseOrdersError ? <p className="form-feedback error">{warehouseOrdersError}</p> : null}

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Vendedor</th>
                      <th>Cliente</th>
                      <th>Ruta</th>
                      <th>Estado</th>
                      <th>Productos</th>
                      <th>Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingWarehouseOrders ? (
                      <tr>
                        <td colSpan={7} className="empty-table-cell">Cargando pedidos recibidos...</td>
                      </tr>
                    ) : warehouseReceivedOrders.length > 0 ? (
                      warehouseReceivedOrders.map((order) => {
                        const totalUnits = order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

                        return (
                          <tr key={order._id}>
                            <td>{formatSellerOrderDate(order.createdAt)}</td>
                            <td>{order.salesRepName}</td>
                            <td>{order.storeName}</td>
                            <td>{`${order.routeName} · ${formatRouteDayLabel(order.routeDay as RouteDayKey)}`}</td>
                            <td>{formatSellerOrderStatus(order.status)}</td>
                            <td>{`${order.items.length} producto${order.items.length === 1 ? "" : "s"} / ${totalUnits} und`}</td>
                            <td>
                              {order.items.length > 0 ? (
                                <button
                                  className="seller-order-detail-trigger"
                                  type="button"
                                  onClick={() => setSelectedWarehouseOrderDetail(order)}
                                >
                                  Ver mas
                                </button>
                              ) : "-"}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={7} className="empty-table-cell">Todavia no han llegado pedidos desde el portal de vendedores.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="database-card">
              <div className="management-table-header">
                <div>
                  <h2>Pedidos completados</h2>
                  <p>Pedidos ya despachados y cerrados. Puedes reimprimir la factura desde aqui.</p>
                </div>
                <p className="management-table-meta">{warehouseCompletedOrders.length} pedidos</p>
              </div>

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Vendedor</th>
                      <th>Cliente</th>
                      <th>Ruta</th>
                      <th>Productos</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingWarehouseOrders ? (
                      <tr>
                        <td colSpan={6} className="empty-table-cell">Cargando pedidos completados...</td>
                      </tr>
                    ) : warehouseCompletedOrders.length > 0 ? (
                      warehouseCompletedOrders.map((order) => {
                        const totalUnits = order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

                        return (
                          <tr key={order._id}>
                            <td>{formatSellerOrderDate(order.updatedAt)}</td>
                            <td>{order.salesRepName}</td>
                            <td>{order.storeName}</td>
                            <td>{`${order.routeName} · ${formatRouteDayLabel(order.routeDay as RouteDayKey)}`}</td>
                            <td>{`${order.items.length} producto${order.items.length === 1 ? "" : "s"} / ${totalUnits} und`}</td>
                            <td className="table-actions-cell">
                              <button
                                className="table-action-icon"
                                type="button"
                                aria-label="Reimprimir factura"
                                title="Reimprimir factura"
                                onClick={() => void handlePrintCompletedOrderSummary(order)}
                              >
                                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                                  <path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z" fill="currentColor" />
                                </svg>
                              </button>
                              <button
                                className="table-action-icon"
                                type="button"
                                aria-label="Ver detalle del pedido"
                                title="Ver detalle"
                                onClick={() => setSelectedWarehouseOrderDetail(order)}
                              >
                                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                                  <path d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z" fill="currentColor" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="empty-table-cell">Todavia no hay pedidos completados.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            {selectedWarehouseOrderDetail ? (
              <div className="modal-overlay" role="presentation" onClick={() => setSelectedWarehouseOrderDetail(null)}>
                <div className="modal-card seller-order-detail-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
                  <div className="modal-header">
                    <div>
                      <p className="section-label">Pedido recibido</p>
                      <h2>{selectedWarehouseOrderDetail.storeName}</h2>
                      <p>{selectedWarehouseOrderDetail.salesRepName} · {formatSellerOrderDate(selectedWarehouseOrderDetail.createdAt)}</p>
                    </div>
                    <button className="modal-close-button" type="button" onClick={() => setSelectedWarehouseOrderDetail(null)}>Cerrar</button>
                  </div>

                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>SKU</th>
                          <th>Producto</th>
                          <th>Stock actual</th>
                          <th className="col-highlight">Cantidad a despachar</th>
                          <th>Costo unit. (AWG)</th>
                          <th>Precio venta (AWG)</th>
                          <th>Utilidad unit. (AWG)</th>
                          <th>Utilidad total (AWG)</th>
                          <th>Notas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedWarehouseOrderDetail.items.map((item) => {
                          const invRow = inventoryRows.find((r) => r.productId === item.productId);
                          const unitCostAwg = Number(invRow?.unitCost ?? 0);
                          const salePriceAwg = Number(invRow?.salePrice ?? 0);
                          const unitUtilityAwg = salePriceAwg - unitCostAwg;
                          const totalUtilityAwg = unitUtilityAwg * Number(item.quantity ?? 0);

                          return (
                            <tr key={`${selectedWarehouseOrderDetail._id}-${item.productId}`}>
                              <td>{item.productSku}</td>
                              <td>{item.productName}</td>
                              <td>{item.stockCurrent ?? "-"}</td>
                              <td className="col-highlight"><strong>{item.quantity}</strong></td>
                              <td>{unitCostAwg > 0 ? formatAwgCurrency2(unitCostAwg) : "-"}</td>
                              <td>{salePriceAwg > 0 ? formatAwgCurrency2(salePriceAwg) : "-"}</td>
                              <td>{unitCostAwg > 0 || salePriceAwg > 0 ? formatAwgCurrency2(unitUtilityAwg) : "-"}</td>
                              <td>{unitCostAwg > 0 || salePriceAwg > 0 ? formatAwgCurrency2(totalUtilityAwg) : "-"}</td>
                              <td>{item.notes || "-"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        ) : (
          <section className="dashboard-grid" />
        )}

        {isCreationSection && isCreationModalOpen ? (
          <div className="modal-overlay" role="presentation" onClick={closeCreationModal}>
            <div
              className="modal-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby={`creation-modal-title-${selectedCollection.key}`}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="modal-header">
                <div>
                  <p className="section-label">{isEditingCreation ? "Modificar registro" : "Nuevo registro"}</p>
                  <h2 id={`creation-modal-title-${selectedCollection.key}`}>
                    {isEditingCreation ? `Modificar ${getOptionLabel(selectedCollection.title)}` : selectedCollection.title}
                  </h2>
                  <p>{selectedCollection.description}</p>
                </div>

                <button className="modal-close-button" type="button" onClick={closeCreationModal}>
                  Cerrar
                </button>
              </div>

              <form
                key={`creation-form-${selectedCollection.key}-${String(editingRow?._id ?? "create")}`}
                className="creation-form"
                onInputCapture={handlePortalInputCapture}
                onSubmit={(event) => void handleCreationSubmit(event, selectedCollection)}
              >
                {selectedCollection.fields.map((field) => {
                  if (field.type === "group-title") {
                    return (
                      <div className="field-group-title form-span-full" key={field.name}>
                        <span>{field.label}</span>
                      </div>
                    );
                  }

                  return (
                    <label
                      className={`field ${
                        field.width === "third"
                          ? "field-third"
                          : field.width === "two-third"
                            ? "field-two-third"
                            : "field-full"
                      }`}
                      key={field.name}
                    >
                      <span>{field.label}</span>
                      {field.type === "select" ? (
                        <select
                          name={field.name}
                          defaultValue={getFormFieldInitialValue(field, editingRow)}
                          required
                          disabled={
                            (field.name === "category" || field.name === "supplier") &&
                            field.options?.length === 0
                          }
                        >
                          {field.options?.length ? null : (
                            <option value="">
                              {field.name === "category"
                                ? "Primero crea una categoria"
                                : "Primero crea un proveedor"}
                            </option>
                          )}
                          {field.options?.map((option, optionIndex) => (
                            <option key={`${field.name}-${option.value}-${optionIndex}`} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : field.type === "file" ? (
                        <div className="image-upload-block">
                          <input
                            key={productImageInputKey}
                            type="file"
                            name={field.name}
                            accept="image/*"
                            onChange={(event) => {
                              const file = event.target.files?.[0] ?? null;
                              void handleProductImageChange(file);
                            }}
                          />

                          {productImage.previewUrl ? (
                            <div className="image-preview-card">
                              <button className="image-remove-button" type="button" onClick={clearProductImage}>
                                x
                              </button>
                              <img src={productImage.previewUrl} alt="Vista previa del producto" />
                              <p>
                                {productImage.isUploading
                                  ? "Subiendo a Cloudinary..."
                                  : productImage.uploadedUrl
                                    ? "Imagen lista"
                                    : productImage.error || "Imagen seleccionada"}
                              </p>
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <input
                          type={field.type}
                          name={field.name}
                          placeholder={field.placeholder}
                          defaultValue={getFormFieldInitialValue(field, editingRow)}
                          required
                        />
                      )}
                    </label>
                  );
                })}

                {selectedCollection.key === "clients" ? (
                  <div className="client-product-assignment form-span-full">
                    <div className="client-product-assignment-header">
                      <div>
                        <p className="section-label">Productos a revisar</p>
                        <h3>Asigna los productos del cliente</h3>
                        <p>Estos productos le indicaran al vendedor que debe chequear en la tienda cuando visite este cliente.</p>
                      </div>
                      <span>{clientProductDraft.productIds.length} asignados</span>
                    </div>

                    <div className="route-store-list client-product-assignment-list">
                      {productOptions.length === 0 ? (
                        <p className="route-empty-state">Primero crea productos para poder asignarlos al cliente.</p>
                      ) : (
                        productOptions.map((product) => (
                          <label className="route-store-option" key={`client-product-${product.value}`}>
                            <input
                              type="checkbox"
                              checked={clientProductDraft.productIds.includes(product.value)}
                              onChange={() => toggleClientDraftProduct(product.value)}
                            />
                            <span>
                              <strong>{product.label}</strong>
                              <small>SKU {product.sku}</small>
                            </span>
                          </label>
                        ))
                      )}
                    </div>

                    <div className="client-product-assignment-summary">
                      {selectedClientDraftProducts.length > 0 ? (
                        selectedClientDraftProducts.map((product) => (
                          <span className="catalog-recipient-pill" key={`client-product-pill-${product.value}`}>
                            <span>{product.label}</span>
                            <strong>{product.sku}</strong>
                          </span>
                        ))
                      ) : (
                        <p className="catalog-recipient-empty">Aun no has asignado productos para este cliente.</p>
                      )}
                    </div>
                  </div>
                ) : null}

                {creationStatuses[selectedCollection.key]?.tone === "error" ? (
                  <p className={`form-feedback form-span-full ${creationStatuses[selectedCollection.key]?.tone}`}>
                    {creationStatuses[selectedCollection.key]?.message}
                  </p>
                ) : null}

                <button className="submit-button form-span-full" type="submit">
                  {isEditingCreation ? "Guardar cambios" : "Guardar"}
                </button>
              </form>
            </div>
          </div>
        ) : null}
        {activeSection === "accounting" && accountingModalKind ? (
          <div className="modal-overlay" role="presentation" onClick={closeAccountingModal}>
            <div className="modal-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
              {accountingModalKind === "fixed-cost" ? (
                <>
                  <div className="modal-header">
                    <div>
                      <p className="section-label">Costo fijo</p>
                      <h2>Registrar costo fijo</h2>
                      <p>Define la nomina, arriendo u otros costos recurrentes que impactan la operacion.</p>
                    </div>
                    <button className="modal-close-button" type="button" onClick={closeAccountingModal}>Cerrar</button>
                  </div>

                  <form className="creation-form" onInputCapture={handlePortalInputCapture} onSubmit={(event) => void handleFixedCostSubmit(event)}>
                    <label className="field field-full">
                      <span>Concepto</span>
                      <input type="text" name="name" placeholder="Nomina administrativa" required />
                    </label>

                    <label className="field field-third">
                      <span>Categoria</span>
                      <select name="category" defaultValue={fixedCostCategoryOptions[0].value} required>
                        {fixedCostCategoryOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>

                    <label className="field field-third">
                      <span>Frecuencia</span>
                      <select name="frequency" defaultValue={fixedCostFrequencyOptions[0].value} required>
                        {fixedCostFrequencyOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>

                    <label className="field field-third">
                      <span>Monto</span>
                      <input type="number" name="amount" min="0" step="0.01" placeholder="3500000" required />
                    </label>

                    <label className="field field-third">
                      <span>Fecha inicio</span>
                      <input type="date" name="startDate" required />
                    </label>

                    <label className="field field-full">
                      <span>Notas</span>
                      <textarea name="notes" rows={3} placeholder="Observaciones sobre este costo fijo." />
                    </label>

                    <button className="submit-button form-span-full" type="submit">Guardar costo fijo</button>
                  </form>
                </>
              ) : (
                <>
                  <div className="modal-header">
                    <div>
                      <p className="section-label">Gasto operacional</p>
                      <h2>Registrar gasto variable</h2>
                      <p>Captura combustible, imprevistos y otros movimientos que afectan el margen operativo.</p>
                    </div>
                    <button className="modal-close-button" type="button" onClick={closeAccountingModal}>Cerrar</button>
                  </div>

                  <form className="creation-form" onInputCapture={handlePortalInputCapture} onSubmit={(event) => void handleOperationalExpenseSubmit(event)}>
                    <label className="field field-two-third">
                      <span>Concepto</span>
                      <input type="text" name="name" placeholder="Combustible reparto Aruba" required />
                    </label>

                    <label className="field field-third">
                      <span>Categoria</span>
                      <select name="category" defaultValue={operationalExpenseCategoryOptions[0].value} required>
                        {operationalExpenseCategoryOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>

                    <label className="field field-third">
                      <span>Monto</span>
                      <input type="number" name="amount" min="0" step="0.01" placeholder="180000" required />
                    </label>

                    <label className="field field-third">
                      <span>Fecha</span>
                      <input type="date" name="expenseDate" required />
                    </label>

                    <label className="field field-full">
                      <span>Notas</span>
                      <textarea name="notes" rows={3} placeholder="Detalle del gasto y su contexto operativo." />
                    </label>

                    <button className="submit-button form-span-full" type="submit">Guardar gasto operacional</button>
                  </form>
                </>
              )}
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
