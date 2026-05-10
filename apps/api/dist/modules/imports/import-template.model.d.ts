export interface ImportExpenseItemRecord {
    key: string;
    label: string;
    amount: number;
    documents: Array<{
        fileName: string;
        url: string;
    }>;
}
export interface ContainerImportProductRecord {
    productId: string;
    selected: boolean;
    boxCount: string;
    importedQuantity: string;
    purchaseUnitCostOrigin: string;
    purchaseBoxCostOrigin: string;
    expirationDate: string;
}
export interface ImportTemplateRecord {
    _id?: string;
    userId: string;
    name: string;
    containerType: string;
    containerSize: "20ft" | "40ft";
    measurementUnit: string;
    notes: string;
    expenseItems: ImportExpenseItemRecord[];
    products: ContainerImportProductRecord[];
    createdAt?: Date;
    updatedAt?: Date;
}
export declare const ImportTemplate: import("mongoose").Model<ImportTemplateRecord, {}, {}, {}, import("mongoose").Document<unknown, {}, ImportTemplateRecord, {}, {}> & ImportTemplateRecord & Required<{
    _id: string;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=import-template.model.d.ts.map