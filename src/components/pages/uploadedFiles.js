export function getUploadedFiles(record) {
  return [
    { type: "Fund request", name: record.fund_request_filename },
    { type: "VA transaction", name: record.va_transaction_filename },
    ...(Array.isArray(record.bank_files)
      ? record.bank_files.map((file) => ({
          type: "Bank statement",
          bankName: file.bank_name,
          name: file.file_name,
          format: file.bank_format,
          accountHolder: file.account_holder,
          accountNumber: file.account_number,
          transactionCount: file.transaction_count,
        }))
      : []),
  ].filter((file) => file.name);
}
