import React, { useState } from "react";
import { ColdChainCertificate } from "../types";
import {
  Snowflake,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Printer,
  Copy,
  Check,
  Hash,
  Activity,
  Award,
  X,
  ExternalLink,
  Lock,
  RefreshCw,
} from "lucide-react";

interface ColdChainCertificateModalProps {
  certificate: ColdChainCertificate | null;
  isOpen: boolean;
  onClose: () => void;
  showToast?: (msg: string) => void;
}

export const ColdChainCertificateModal: React.FC<ColdChainCertificateModalProps> = ({
  certificate,
  isOpen,
  onClose,
  showToast,
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<string | null>(null);

  if (!isOpen || !certificate) return null;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    if (showToast) showToast(`Copied ${label} to clipboard!`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleVerifyLedger = async () => {
    setIsVerifying(true);
    setVerificationResult(null);
    try {
      const res = await fetch(`/api/deliveries/${certificate.deliveryId}/verify-audit-chain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ certificate }),
      });
      const data = await res.json();
      if (data.valid) {
        setVerificationResult("All 6 SHA-256 hash blocks cryptographically valid. Chain unbroken.");
        if (showToast) showToast("Cryptographic proof verified successfully!");
      } else {
        setVerificationResult(data.message || "Hash verification failed.");
      }
    } catch (err: any) {
      setVerificationResult("Error verifying cryptographic hashes: " + err.message);
    } finally {
      setIsVerifying(false);
    }
  };

  const isCompliant = certificate.integrityStatus === "CERTIFIED_SAFE";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-auto text-slate-100 max-h-[92vh] flex flex-col">
        {/* Top Header / Certificate Seal */}
        <div className="p-5 sm:p-6 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/40 flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border-2 border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0 shadow-lg shadow-cyan-950/50">
              <Award className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-black tracking-widest text-cyan-400 uppercase font-mono">
                  FDA 21 CFR Part 11 & WHO GDP
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1 font-mono">
                  <Lock className="w-3 h-3" />
                  SHA-256 IMMUTABLE LEDGER
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-0.5">
                Digital Cold-Chain Integrity Certificate
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Cryptographically signed proof of unbroken thermal containment across logistics lifecycle.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Certificate Body (Scrollable) */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 text-xs flex-1">
          {/* Status Banner */}
          <div
            className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
              isCompliant
                ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-300"
                : "bg-rose-950/30 border-rose-500/40 text-rose-300"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 ${
                  isCompliant ? "bg-emerald-600 shadow-lg shadow-emerald-900/50" : "bg-rose-600"
                }`}
              >
                {isCompliant ? <ShieldCheck className="w-6 h-6" /> : <Flame className="w-6 h-6" />}
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider block">
                  Thermal Compliance Status
                </span>
                <strong className="text-base font-black text-white">
                  {isCompliant ? "100% CERTIFIED COMPLIANT (UNBROKEN COLD-CHAIN)" : "THERMAL EXCURSION DETECTED"}
                </strong>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleVerifyLedger}
                disabled={isVerifying}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isVerifying ? "animate-spin text-cyan-400" : ""}`} />
                <span>Verify Cryptographic Hashes</span>
              </button>
            </div>
          </div>

          {verificationResult && (
            <div className="p-3 rounded-xl bg-slate-900 border border-cyan-500/40 text-cyan-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-mono text-xs">{verificationResult}</span>
            </div>
          )}

          {/* Certificate Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Certificate ID</span>
              <span className="text-xs font-mono font-black text-cyan-300 mt-1 block truncate">
                {certificate.certificateId}
              </span>
            </div>

            <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Package / Lot</span>
              <span className="text-xs font-bold text-white mt-1 block truncate">
                {certificate.productName}
              </span>
            </div>

            <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Carrier Van</span>
              <span className="text-xs font-mono font-bold text-amber-300 mt-1 block">
                {certificate.carrierTruckId}
              </span>
            </div>

            <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">IoT Sensor Unit</span>
              <span className="text-xs font-mono font-bold text-emerald-300 mt-1 block">
                {certificate.sensorId}
              </span>
            </div>
          </div>

          {/* Recipient & Destination Box */}
          <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Consignee Recipient</span>
              <span className="text-sm font-extrabold text-white mt-0.5 block">{certificate.recipient}</span>
              <span className="text-xs text-slate-400 mt-0.5 block">{certificate.destinationAddress}</span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Timestamp of Certification</span>
              <span className="text-xs font-mono text-slate-200 mt-0.5 block">
                {new Date(certificate.issuedAt).toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Audit Standard: {certificate.standardCompliance}
              </span>
            </div>
          </div>

          {/* Thermal Telemetry Summary Metrics */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-1.5">
              <Snowflake className="w-3.5 h-3.5 text-cyan-400" />
              <span>Thermal Profile Readings</span>
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-900/90 p-3 rounded-2xl border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Min Temp</span>
                <span className="text-base font-black text-cyan-300 font-mono block mt-0.5">
                  {certificate.minTempRecorded}°C
                </span>
              </div>
              <div className="bg-slate-900/90 p-3 rounded-2xl border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Average Temp</span>
                <span className="text-base font-black text-emerald-400 font-mono block mt-0.5">
                  {certificate.avgTempRecorded}°C
                </span>
              </div>
              <div className="bg-slate-900/90 p-3 rounded-2xl border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Max Temp</span>
                <span className="text-base font-black text-amber-300 font-mono block mt-0.5">
                  {certificate.maxTempRecorded}°C
                </span>
              </div>
            </div>
          </div>

          {/* Cryptographic Hash Chain Audit Ledger */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-purple-400" />
                <span>Blockchain IoT Telemetry Ledger ({certificate.telemetryBlocks.length} Blocks)</span>
              </h4>
              <span className="text-[10px] font-mono text-slate-500">Chained via SHA-256</span>
            </div>

            <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900 border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase">
                      <th className="py-2.5 px-3"># Block</th>
                      <th className="py-2.5 px-3">Waypoint Checkpoint</th>
                      <th className="py-2.5 px-3">Cargo Temp</th>
                      <th className="py-2.5 px-3">Ambient</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Block Hash (SHA-256)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900 text-[11px] font-mono">
                    {certificate.telemetryBlocks.map((b) => (
                      <tr key={b.blockIndex} className="hover:bg-slate-900/50 transition">
                        <td className="py-2 px-3 font-bold text-slate-400">
                          {b.blockIndex === 0 ? "GENESIS" : `#${b.blockIndex}`}
                        </td>
                        <td className="py-2 px-3 font-sans font-medium text-slate-200">
                          {b.location.label || `GPS (${b.location.lat.toFixed(4)}, ${b.location.lng.toFixed(4)})`}
                        </td>
                        <td className="py-2 px-3 font-bold text-cyan-300">{b.cargoTempC}°C</td>
                        <td className="py-2 px-3 text-slate-400">{b.ambientTempC}°C</td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              b.status === "COMPLIANT"
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                            }`}
                          >
                            {b.status}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-purple-300/80 font-mono">
                              {b.hash.slice(0, 10)}...{b.hash.slice(-8)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(b.hash, `Block #${b.blockIndex} hash`)}
                              className="text-slate-500 hover:text-slate-300 p-0.5"
                              title="Copy full hash"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Cryptographic Roots & Signature */}
          <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 space-y-3 font-mono text-[11px]">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">
                Merkle / Root Hash (Final Block)
              </span>
              <div className="flex items-center justify-between gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800/80 mt-1">
                <span className="text-purple-300 break-all">{certificate.rootHash}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(certificate.rootHash, "Root Hash")}
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 shrink-0 flex items-center gap-1 font-sans text-xs cursor-pointer"
                >
                  {copiedField === "Root Hash" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>Copy</span>
                </button>
              </div>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">
                Issuer HMAC Digital Signature Seal
              </span>
              <div className="flex items-center justify-between gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800/80 mt-1">
                <span className="text-cyan-300 break-all">{certificate.digitalSignature}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(certificate.digitalSignature, "Digital Signature")}
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 shrink-0 flex items-center gap-1 font-sans text-xs cursor-pointer"
                >
                  {copiedField === "Digital Signature" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>Copy</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Cryptographically sealed by CargoFlow Fleet Authority</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition cursor-pointer shadow-lg shadow-cyan-900/30"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
