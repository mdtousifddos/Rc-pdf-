const express = require('express');
const cors = require('cors');
const axios = require('axios');
const FormData = require('form-data');
const { PDFDocument, rgb, StandardFonts, degrees } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3175;  // 🔴 ये line change की है
app.use(cors());
app.use(express.json());

const STATE_MAP = {
    "AP": "Andhra Pradesh", "UP": "Uttar Pradesh", "MH": "Maharashtra",
    "HR": "Haryana", "DL": "Delhi", "KA": "Karnataka", "TN": "Tamil Nadu",
    "GJ": "Gujarat", "WB": "West Bengal", "RJ": "Rajasthan", "MP": "Madhya Pradesh",
    "PB": "Punjab", "BR": "Bihar", "OD": "Odisha", "AS": "Assam", "KL": "Kerala"
};

app.get('/generate-rc', async (req, res) => {
    try {
        const vehicleNumber = req.query.pdf;
        if (!vehicleNumber) {
            return res.status(400).json({ 
                success: false, 
                error: 'Vehicle number is required. Use: /generate-rc?pdf=UP32JP2433' 
            });
        }
        
        console.log(`🔍 Fetching: ${vehicleNumber}`);
        
        const apiUrl = `https://salaar.ashupanel.online/api.php?reg=${vehicleNumber}`;
        const apiRes = await axios.get(apiUrl);
        const data = apiRes.data;
        
        const formData = {
            regnNo: data.registration_number || vehicleNumber,
            dateOfRegn: formatDate(data.registration_date),
            regnValidity: formatDate(data.registration_valid_upto),
            ownerSerial: data.owner?.owner_serial || '1',
            chassisNumber: data.technical_details?.chassis_number || '',
            engineNumber: data.technical_details?.engine_number || '',
            ownerName: data.owner?.owner_name || '',
            sonOf: data.owner?.father_name || '',
            address: data.address?.present_address || data.address?.permanent_address || '',
            maker: data.vehicle?.manufacturer || '',
            model: data.vehicle?.model || '',
            bodyType: data.vehicle?.body_type || '',
            color: data.vehicle?.color || '',
            fuelType: data.technical_details?.fuel_type || '',
            seatCapacity: data.technical_details?.seating_capacity || '',
            cubicCapacity: data.technical_details?.cubic_capacity || data.technical_details?.engine_cc || '',
            wheelbase: data.technical_details?.wheel_base || '',
            manufacturingDate: formatDate(data.manufacturing?.month_year),
            registeredAt: data.registration_authority?.rto || '',
            normsType: data.technical_details?.emission_norms || '',
            vehicleClass: data.vehicle?.vehicle_class || '',
            financerDetails: data.finance?.financer_name || '',
            unladenWeight: data.technical_details?.unladen_weight || '',
            cylinders: data.technical_details?.cylinders || '',
            stateCode: (data.registration_number || vehicleNumber).substring(0, 2).toUpperCase()
        };
        
        console.log(`📄 Generating PDF for: ${formData.regnNo}`);
        
        const templatePath = path.join(__dirname, 'rc.pdf');
        const templateBytes = await fs.readFile(templatePath);
        const pdfDoc = await PDFDocument.load(templateBytes);
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const black = rgb(0, 0, 0);
        const page = pdfDoc.getPages()[0];
        
        page.drawText(formData.regnNo, { x: 104, y: 756, size: 5.8, font: font });
        page.drawText(formData.regnNo, { x: 313, y: 756, size: 5.8, font: font });
        page.drawText(formData.dateOfRegn, { x: 156, y: 756, size: 5.8, font: font });
        page.drawText(formData.regnValidity, { x: 205, y: 756, size: 5.8, font: font });
        page.drawText(formData.ownerSerial, { x: 279.5, y: 757, size: 5.8, font: boldFont });
        
        page.drawText(formData.chassisNumber, { x: 104, y: 737, size: 6, font: font });
        page.drawText(formData.engineNumber, { x: 104, y: 718, size: 6, font: font });
        page.drawText(formData.ownerName, { x: 104, y: 700, size: 5.8, font: font });
        page.drawText(formData.sonOf, { x: 104, y: 681, size: 5.8, font: font });
        page.drawText(formData.fuelType, { x: 44, y: 684, size: 5.8, font: font });
        page.drawText(formData.normsType, { x: 44, y: 666, size: 5.8, font: font });
        page.drawText(formData.vehicleClass, { x: 423, y: 785, size: 6.8, font: font });
        
        const stateShort = formData.regnNo.substring(0, 2).toUpperCase();
        const stateFull = STATE_MAP[stateShort] || '';
        if (stateFull) {
            page.drawText(stateFull, { x: 175, y: 777, size: 7, font: boldFont });
            page.drawText(stateShort, { x: 331, y: 782, size: 6.6, font: font });
            page.drawText(stateShort, { x: 276, y: 784, size: 6.6, font: font });
        }
        
        page.drawText(formData.maker, { x: 395, y: 758, size: 5.8, font: font });
        page.drawText(formData.model, { x: 395, y: 740, size: 5.8, font: font });
        page.drawText(formData.color, { x: 395, y: 722, size: 5.8, font: font });
        page.drawText(formData.bodyType, { x: 470, y: 722, size: 5.8, font: font });
        page.drawText(formData.seatCapacity, { x: 395, y: 704, size: 5.8, font: font });
        page.drawText(formData.unladenWeight, { x: 395, y: 685, size: 5.8, font: font });
        page.drawText(formData.cubicCapacity, { x: 395, y: 665, size: 5.8, font: font });
        page.drawText(formData.wheelbase, { x: 500, y: 665, size: 5.8, font: font });
        page.drawText(formData.manufacturingDate, { x: 313, y: 660, size: 5.8, font: font });
        page.drawText(formData.cylinders, { x: 371, y: 651, size: 6.2, font: font });
        page.drawText(formData.financerDetails, { x: 395, y: 647, size: 5.8, font: font });
        
        if (formData.registeredAt) {
            const textWidth = font.widthOfTextAtSize(formData.registeredAt, 5.8);
            const startX = 550 - textWidth;
            page.drawText(formData.registeredAt, { x: startX, y: 647, size: 5.8, font: font });
        }
        
        if (formData.address) {
            const words = formData.address.split(' ');
            const lines = [];
            let currentLine = '';
            for (const word of words) {
                const testLine = currentLine ? `${currentLine} ${word}` : word;
                const width = font.widthOfTextAtSize(testLine, 5.8);
                if (width > 156 && currentLine.length > 0) {
                    lines.push(currentLine);
                    currentLine = word;
                } else {
                    currentLine = testLine;
                }
            }
            if (currentLine) lines.push(currentLine);
            let y = 663;
            for (const line of lines) {
                page.drawText(line, { x: 104, y: y, size: 5.8, font: font });
                y -= 9;
            }
        }
        
        if (formData.dateOfRegn) {
            page.drawText(formData.dateOfRegn, { x: 287, y: 710, size: 5, font: font, rotate: degrees(90) });
        }
        
        const xmlString = `<?xml version="1.0"?><root><book><PrintLetterBarcodeData RegNo="${formData.regnNo}" ChassisNo="${formData.chassisNumber}" EngineNo="${formData.engineNumber}" OwnerName="${formData.ownerName}" FatherName="${formData.sonOf}" Address="${formData.address}" RegDate="${formData.dateOfRegn}" ExpiryDate="${formData.regnValidity}"/></book></root>`;
        
        const qrBuffer = await QRCode.toBuffer(xmlString, { width: 140, margin: 0, color: { dark: '#000000', light: '#ffffff' } });
        const qrImage = await pdfDoc.embedPng(qrBuffer);
        page.drawImage(qrImage, { x: 313, y: 680, width: 72, height: 72 });
        
        const modifiedPdfBytes = await pdfDoc.save();
        
        const tempFormData = new FormData();
        tempFormData.append('files', Buffer.from(modifiedPdfBytes), { filename: `RC_${formData.regnNo}.pdf`, contentType: 'application/pdf' });
        tempFormData.append('expiryHours', '24');
        
        const uploadRes = await axios.post('https://tempfile.org/api/upload/local', tempFormData, {
            headers: { ...tempFormData.getHeaders() },
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });
        
        if (uploadRes.data.success) {
            res.json({
                success: true,
                pdf_url: uploadRes.data.files[0].url,
                pdf_direct_url: `https://tempfile.org/${uploadRes.data.files[0].id}/download`,
                file_id: uploadRes.data.files[0].id,
                expiry_time: uploadRes.data.files[0].expiryTime,
                data: {
                    vehicle_number: formData.regnNo,
                    owner_name: formData.ownerName,
                    father_name: formData.sonOf,
                    cylinders: formData.cylinders,
                    vehicle_class: formData.vehicleClass,
                    state_code: formData.stateCode
                }
            });
        } else {
            throw new Error(uploadRes.data.error || 'Upload failed');
        }
        
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

function formatDate(dateStr) {
    if (!dateStr) return '';
    if (dateStr.match(/^\d{2}-\d{2}-\d{4}$/)) return dateStr.replace(/-/g, '/');
    return dateStr;
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
    console.log(`📌 Example: http://localhost:${PORT}/generate-rc?pdf=UP32JP2433`);
});
