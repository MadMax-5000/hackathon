import type { HistoricalRecord, Insight } from "../../insights/types.ts";
import { Icon } from "../Icon";

function yesNo(value: boolean, yes: string, no: string): string {
  return value ? yes : no;
}

export function SupportingCases({
  insight,
  records,
  onClose,
}: {
  insight: Insight;
  records: HistoricalRecord[];
  onClose: () => void;
}) {
  const byId = new Map(records.map((record) => [record.case_id, record]));
  const rows = insight.supportingCaseIds
    .map((id) => byId.get(id))
    .filter((record): record is HistoricalRecord => Boolean(record));

  return (
    <div className="supporting-cases">
      <header className="supporting-head">
        <div>
          <h4>
            <Icon name="layers" size={16} />
            Supporting cases
          </h4>
          <p className="supporting-label">Synthetic historical records</p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Close
        </button>
      </header>

      {rows.length === 0 ? (
        <p className="empty">No supporting synthetic records for this insight.</p>
      ) : (
        <div className="supporting-scroll">
          <table className="supporting-table">
            <thead>
              <tr>
                <th scope="col">Record</th>
                <th scope="col">Issue</th>
                <th scope="col">Hrs to offer</th>
                <th scope="col">Target</th>
                <th scope="col">Measurement</th>
                <th scope="col">Stock</th>
                <th scope="col">Correction</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((record) => (
                <tr key={record.case_id}>
                  <td>{record.case_id}</td>
                  <td>{record.issue_type}</td>
                  <td>{record.hours_to_offer.toFixed(1)}</td>
                  <td className={record.missed_target ? "tone-bad" : "tone-ok"}>
                    {record.missed_target ? "Missed" : "Met"}
                  </td>
                  <td>{yesNo(record.measurement_complete, "Complete", "Incomplete")}</td>
                  <td>{yesNo(record.stock_confirmed, "Confirmed", "Pending")}</td>
                  <td>{yesNo(record.technician_correction, "Yes", "No")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
