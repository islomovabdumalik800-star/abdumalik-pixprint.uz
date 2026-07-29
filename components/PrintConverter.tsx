
"use client";

import React, { useState, useRef, ChangeEvent, useEffect } from "react";
import { Upload, Download, Sliders, FileImage, ShieldCheck, RefreshCw, Maximize2, FileText, Clipboard, Image as ImageIcon, Code } from "lucide-react";
import jsPDF from "jspdf";

interface ImageSpecs {
  widthPx: number;
  heightPx: number;
  dpi: number;
  bleedMm: number;
  widthMm: string;
  heightMm: string;
}

export default function PrintConverter() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [dpi, setDpi] = useState<number>(300);
  const [bleedMm, setBleedMm] = useState<number>(3);
  const [specs, setSpecs] = useState<ImageSpecs | null>(null);
  const [originalDimensions, setOriginalDimensions] = useState<{ w: number; h: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const pxToMm = (px: number, currentDpi: number): string => {
    return ((px / currentDpi) * 25.4).toFixed(1);
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/") && !file.type.includes("svg")) return;
    
    setFileName(file.name || "pasted-image.png");
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        setImageSrc(img.src);
        setOriginalDimensions({ w: img.width, h: img.height });
        updateSpecs(img.width, img.height, dpi, bleedMm);
      };
    };
    reader.readAsDataURL(file);
  };

  // Clipboard (Ctrl + V) orqali rasm joylash
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1 || items[i].type.includes("svg")) {
          const file = items[i].getAsFile();
          if (file) {
            processFile(file);
            break;
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [dpi, bleedMm]);

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const updateSpecs = (wPx: number, hPx: number, currentDpi: number, bleed: number) => {
    setSpecs({
      widthPx: wPx,
      heightPx: hPx,
      dpi: currentDpi,
      bleedMm: bleed,
      widthMm: pxToMm(wPx, currentDpi),
      heightMm: pxToMm(hPx, currentDpi),
    });
  };

  const handleResetOrNewUpload = () => {
    setImageSrc(null);
    setFileName("");
    setSpecs(null);
    setOriginalDimensions(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handlePresetPxChange = (targetWidthPx: number) => {
    if (!originalDimensions) return;
    const aspectRatio = originalDimensions.h / originalDimensions.w;
    const newHeightPx = Math.round(targetWidthPx * aspectRatio);
    updateSpecs(targetWidthPx, newHeightPx, dpi, bleedMm);
  };

  const handleDpiChange = (newDpi: number) => {
    setDpi(newDpi);
    if (specs) updateSpecs(specs.widthPx, specs.heightPx, newDpi, bleedMm);
  };

  const handleBleedChange = (newBleed: number) => {
    setBleedMm(newBleed);
    if (specs) updateSpecs(specs.widthPx, specs.heightPx, dpi, newBleed);
  };

  // Canvas tayyorlovchi funksiya
  const prepareCanvas = (backgroundColor: string = "#FFFFFF"): HTMLCanvasElement | null => {
    if (!imageSrc || !specs) return null;
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const img = new Image();
    img.src = imageSrc;

    const mmToPxRatio = dpi / 25.4;
    const bleedPx = Math.round(bleedMm * mmToPxRatio);

    canvas.width = specs.widthPx + bleedPx * 2;
    canvas.height = specs.heightPx + bleedPx * 2;

    if (backgroundColor !== "transparent") {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    ctx.drawImage(img, bleedPx, bleedPx, specs.widthPx, specs.heightPx);

    // Crop Marks (Kesim belgilari)
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = Math.max(1, Math.round(dpi / 150));

    // Yuqori Chap
    ctx.beginPath();
    ctx.moveTo(bleedPx, 0); ctx.lineTo(bleedPx, bleedPx - 5);
    ctx.moveTo(0, bleedPx); ctx.lineTo(bleedPx - 5, bleedPx);
    ctx.stroke();

    // Yuqori O'ng
    ctx.beginPath();
    ctx.moveTo(canvas.width - bleedPx, 0); ctx.lineTo(canvas.width - bleedPx, bleedPx - 5);
    ctx.moveTo(canvas.width, bleedPx); ctx.lineTo(canvas.width - bleedPx + 5, bleedPx);
    ctx.stroke();

    return canvas;
  };

  // 1. PNG Eksport
  const downloadPNG = () => {
    const canvas = prepareCanvas("transparent");
    if (!canvas || !specs) return;

    const link = document.createElement("a");
    link.download = `PRINT_${specs.widthPx}px_${dpi}DPI_${fileName.replace(/\.[^/.]+$/, "")}.png`;
    link.href = canvas.toDataURL("image/png", 1.0);
    link.click();
  };

  // 2. JPG Eksport
  const downloadJPG = () => {
    const canvas = prepareCanvas("#FFFFFF");
    if (!canvas || !specs) return;

    const link = document.createElement("a");
    link.download = `PRINT_${specs.widthPx}px_${dpi}DPI_${fileName.replace(/\.[^/.]+$/, "")}.jpg`;
    link.href = canvas.toDataURL("image/jpeg", 0.95);
    link.click();
  };

  // 3. PDF Eksport
  const downloadPDF = () => {
    const canvas = prepareCanvas("#FFFFFF");
    if (!canvas || !specs) return;

    const imgData = canvas.toDataURL("image/jpeg", 1.0);
    const pdfWidthMm = parseFloat(specs.widthMm) + specs.bleedMm * 2;
    const pdfHeightMm = parseFloat(specs.heightMm) + specs.bleedMm * 2;

    const pdf = new jsPDF({
      orientation: pdfWidthMm > pdfHeightMm ? "landscape" : "portrait",
      unit: "mm",
      format: [pdfWidthMm, pdfHeightMm],
    });

    pdf.addImage(imgData, "JPEG", 0, 0, pdfWidthMm, pdfHeightMm);
    pdf.save(`PRINT_${specs.widthPx}px_${dpi}DPI_${fileName.replace(/\.[^/.]+$/, "")}.pdf`);
  };

  // 4. SVG Eksport (Vector wrap & Print Specs)
  const downloadSVG = () => {
    if (!imageSrc || !specs) return;

    const totalWidthMm = parseFloat(specs.widthMm) + specs.bleedMm * 2;
    const totalHeightMm = parseFloat(specs.heightMm) + specs.bleedMm * 2;

    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidthMm}mm" height="${totalHeightMm}mm" viewBox="0 0 ${specs.widthPx} ${specs.heightPx}">
  <style>
    .crop-mark { stroke: #000; stroke-width: 2; }
  </style>
  <rect width="100%" height="100%" fill="#ffffff"/>
  <image href="${imageSrc}" width="${specs.widthPx}" height="${specs.heightPx}"/>
</svg>`;

    const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `PRINT_${specs.widthPx}px_${dpi}DPI_${fileName.replace(/\.[^/.]+$/, "")}.svg`;
    link.click();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
      <canvas ref={canvasRef} className="hidden" />

      <input
        type="file"
        ref={fileInputRef}
        accept="image/*,.svg"
        onChange={handleImageUpload}
        className="hidden"
      />

      {/* Header */}
      <div className="max-w-4xl w-full text-center mb-8">
        <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-3">
          <ShieldCheck className="w-4 h-4" /> Micro-SaaS Engine v1.3
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2">
          Abdumalik | PixPrint
        </h1>
        <p className="text-slate-400">
          Rasmlar va fayllarni bir zumda PDF, PNG, JPG yoki SVG formatga  o'tkazing.
        </p>
      </div>

      {/* Main Grid */}
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Upload & Preview Box */}
        <div className="md:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between shadow-2xl">
          {!imageSrc ? (
            <label 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-blue-500 transition-colors rounded-xl flex flex-col items-center justify-center p-8 cursor-pointer group h-80 relative"
            >
              <Upload className="w-12 h-12 text-slate-500 group-hover:text-blue-400 transition-colors mb-3" />
              <span className="text-slate-300 font-medium mb-1">Rasm yoki faylni tanlang</span>
              <span className="text-slate-500 text-sm mb-4">PNG, JPG, JPEG, SVG (Max 50MB)</span>
              
              <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 text-xs text-slate-400 px-3 py-1.5 rounded-lg">
                <Clipboard className="w-3.5 h-3.5 text-blue-400" />
                <span>Yoki rasmni nusxalab (Ctrl + V) tashlang</span>
              </div>
            </label>
          ) : (
            <div className="flex flex-col items-center w-full">
              <div className="relative bg-slate-950 border border-slate-800 rounded-lg p-2 max-h-64 overflow-hidden mb-4 flex items-center justify-center w-full">
                <img src={imageSrc} alt="Preview" className="max-h-56 object-contain rounded" />
              </div>
              
              <div className="flex items-center justify-between w-full bg-slate-950 px-4 py-2 rounded-lg border border-slate-800 mb-2">
                <div className="flex items-center gap-2 text-sm text-slate-400 truncate">
                  <FileImage className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="truncate max-w-[180px]">{fileName}</span>
                </div>
                
                <button
                  onClick={handleResetOrNewUpload}
                  className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-blue-400 text-xs font-semibold px-3 py-1.5 rounded-md transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Boshqa fayl yuklash
                </button>
              </div>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>Rejim: <strong className="text-emerald-400">Pro License Unlocked</strong></span>
            <span>Formatlar: <strong>PNG / JPG / PDF / SVG</strong></span>
          </div>
        </div>

        {/* Controls & Specs */}
        <div className="md:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between shadow-2xl">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
              <Sliders className="w-5 h-5 text-blue-400" /> Matbaa Sozlamalari
            </h2>

            {/* PRESET PIXEL SIZES */}
            <div className="mb-5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <Maximize2 className="w-3.5 h-3.5 text-blue-400" /> Kenglik (Preset PX)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[360, 720, 1080].map((pxVal) => (
                  <button
                    key={pxVal}
                    disabled={!imageSrc}
                    onClick={() => handlePresetPxChange(pxVal)}
                    className={`py-2 text-sm font-semibold rounded-lg border transition-all ${
                      specs?.widthPx === pxVal
                        ? "bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-500/30"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    }`}
                  >
                    {pxVal}px
                  </button>
                ))}
              </div>
            </div>

            {/* DPI Select */}
            <div className="mb-5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                Zichlik ko'rsatkichi (DPI)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[150, 300, 600].map((val) => (
                  <button
                    key={val}
                    onClick={() => handleDpiChange(val)}
                    className={`py-2 text-sm font-semibold rounded-lg border transition-all ${
                      dpi === val
                        ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/30"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800"
                    }`}
                  >
                    {val} DPI
                  </button>
                ))}
              </div>
            </div>

            {/* Bleed Select */}
            <div className="mb-6">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                Kesim Joyi (Bleed Margin)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[0, 3, 5].map((mm) => (
                  <button
                    key={mm}
                    onClick={() => handleBleedChange(mm)}
                    className={`py-2 text-sm font-semibold rounded-lg border transition-all ${
                      bleedMm === mm
                        ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/30"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800"
                    }`}
                  >
                    {mm} mm
                  </button>
                ))}
              </div>
            </div>

            {/* Live Specs Display */}
            {specs && (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Tanlangan px:</span>
                  <span className="font-mono text-violet-400 font-bold">{specs.widthPx} x {specs.heightPx} px</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Bosma o'lchami:</span>
                  <span className="font-mono text-emerald-400 font-bold">{specs.widthMm} x {specs.heightMm} mm</span>
                </div>
              </div>
            )}
          </div>

          {/* Export Buttons: PNG, JPG, PDF, SVG */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={downloadPNG}
              disabled={!imageSrc}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                imageSrc
                  ? "bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20 active:scale-[0.98]"
                  : "bg-slate-800 text-slate-500 cursor-not-allowed"
              }`}
            >
              <Download className="w-3.5 h-3.5" /> PNG
            </button>

            <button
              onClick={downloadJPG}
              disabled={!imageSrc}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                imageSrc
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-500/20 active:scale-[0.98]"
                  : "bg-slate-800 text-slate-500 cursor-not-allowed"
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" /> JPG
            </button>

            <button
              onClick={downloadPDF}
              disabled={!imageSrc}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                imageSrc
                  ? "bg-violet-600 hover:bg-violet-500 text-white shadow-md shadow-violet-500/20 active:scale-[0.98]"
                  : "bg-slate-800 text-slate-500 cursor-not-allowed"
              }`}
            >
              <FileText className="w-3.5 h-3.5" /> PDF
            </button>

            <button
              onClick={downloadSVG}
              disabled={!imageSrc}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                imageSrc
                  ? "bg-amber-600 hover:bg-amber-500 text-white shadow-md shadow-amber-500/20 active:scale-[0.98]"
                  : "bg-slate-800 text-slate-500 cursor-not-allowed"
              }`}
            >
              <Code className="w-3.5 h-3.5" /> SVG
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}