import { useState, useRef, useEffect } from 'react';
import { FileJson, Download, ChevronDown, FileText } from 'lucide-react';
// xlsx and FileSpreadsheet removed

export interface ColumnDef<T> {
  header: string;
  accessorKey?: keyof T;
  accessorFn?: (item: T) => string | number | boolean | null | undefined;
}

export interface ExportSheet<T> {
  name: string;
  data: T[];
  columns: ColumnDef<T>[];
}

interface ExportButtonProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  filename?: string;
  label?: string;
  disabled?: boolean;
  extraSheets?: ExportSheet<any>[];
}

export default function ExportButton<T>({
  data,
  columns,
  filename = 'export',
  label,
  disabled = false,
  extraSheets = []
}: ExportButtonProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const prepareDataForSheet = <K,>(sheetData: K[], sheetColumns: ColumnDef<K>[]) => {
    return sheetData.map(item => {
      const row: Record<string, any> = {};
      if (!sheetColumns) return row;

      sheetColumns.forEach(col => {
        let value: any;
        if (col.accessorFn) {
          value = col.accessorFn(item);
        } else if (col.accessorKey) {
          value = item[col.accessorKey];
        }
        row[col.header] = value;
      });
      return row;
    });
  };

  const exportToCSV = () => {
    if (data.length === 0) return;

    const headers = columns.map(col => col.header);

    const rows = data.map(item => {
      return columns.map(col => {
        let value: any;
        if (col.accessorFn) {
          value = col.accessorFn(item);
        } else if (col.accessorKey) {
          value = item[col.accessorKey];
        }

        if (value === null || value === undefined) return '';
        return String(value);
      });
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsOpen(false);
  };

  const exportToJSON = () => {
    if (data.length === 0) return;

    const jsonContent = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}-${new Date().toISOString().split('T')[0]}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled || data.length === 0}
        className={`px-3 py-2 text-sm bg-muted/40 hover:bg-muted/60 text-foreground rounded-lg border border-white/10 transition-all duration-200 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${isOpen ? 'bg-muted/60 ring-1 ring-[#F0A741]/20' : ''}`}
        title={`Export ${label || 'data'}`}
      >
        <Download className="w-4 h-4" />
        <span className="hidden sm:inline">Export</span>
        <ChevronDown className={`w-3 h-3 text-foreground/50 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-[#0A0A0A] border border-white/10 rounded-xl shadow-xl z-[100] overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="p-1">
            {extraSheets.length > 0 && (
              <button
                onClick={() => {
                  const historySheet = extraSheets.find(s => s.name === 'History') || extraSheets[0];
                  if (!historySheet) return;

                  // Temporary data swap for CSV export
                  const originalData = data;
                  const originalColumns = columns;
                  const originalFilename = filename;

                  // We need to re-use the exportToCSV logic but with different data
                  // Since exportToCSV uses component state/props, we can't easily swap them without refactoring
                  // Instead, let's implement a specific handler here

                  const headers = historySheet.columns.map(col => col.header);
                  const rows = historySheet.data.map(item => {
                    return historySheet.columns.map(col => {
                      let value: any;
                      if (col.accessorFn) {
                        value = col.accessorFn(item);
                      } else if (col.accessorKey) {
                        value = item[col.accessorKey];
                      }
                      if (value === null || value === undefined) return '';
                      return String(value);
                    });
                  });

                  const csvContent = [
                    headers.join(','),
                    ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
                  ].join('\n');

                  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                  const link = document.createElement('a');
                  const url = URL.createObjectURL(blob);
                  link.setAttribute('href', url);
                  link.setAttribute('download', `${filename}-history-${new Date().toISOString().split('T')[0]}.csv`);
                  link.style.visibility = 'hidden';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground/80 hover:text-foreground hover:bg-white/5 rounded-lg transition-colors text-left"
              >
                <FileText className="w-4 h-4 text-orange-400" />
                <span>Export History (CSV)</span>
              </button>
            )}
            <button
              onClick={exportToCSV}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground/80 hover:text-foreground hover:bg-white/5 rounded-lg transition-colors text-left"
            >
              <FileText className="w-4 h-4 text-blue-400" />
              <span>Export as CSV</span>
            </button>
            <button
              onClick={exportToJSON}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground/80 hover:text-foreground hover:bg-white/5 rounded-lg transition-colors text-left"
            >
              <FileJson className="w-4 h-4 text-yellow-400" />
              <span>Export as JSON</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
