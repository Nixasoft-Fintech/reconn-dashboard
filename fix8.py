p = r"D:\bank-statement-reconciliation\frontend\reconsile\src\components\tables\TransactionTable.jsx"
lines = open(p).read().splitlines(keepends=True)
# remove lines 38-59 (1-indexed) => indices 37..58
del lines[37:59]
open(p, "w").write("".join(lines))
print("done")