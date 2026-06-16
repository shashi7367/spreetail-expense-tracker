import re
from django.utils import timezone
from decimal import Decimal
import random

class OCRReceiptScanner:
    @staticmethod
    def scan_receipt(file_name, file_content=None):
        """
        Simulates OCR scanning of an image/file.
        Parses text/heuristics of the file name and content, and returns structured data.
        """
        # Clean file name to lowercase for search
        name_clean = file_name.lower()
        
        # Default scanner values
        merchant = "Local Market"
        category = "OTHER"
        amount = 1250.00
        description = "Scanned Receipt - Supplies"
        date = timezone.now().date().strftime("%Y-%m-%d")
        
        # Heuristics based on popular names/keywords
        if any(k in name_clean for k in ["starbucks", "coffee", "cafe", "restaurant", "mcdonald", "food", "dinner", "lunch"]):
            merchant = "Starbucks Coffee" if "starbucks" in name_clean else "Downtown Diner"
            category = "FOOD"
            amount = 350.00 if "starbucks" in name_clean else 1580.00
            description = "Team Coffee Break" if "starbucks" in name_clean else "Group Dinner"
            
        elif any(k in name_clean for k in ["uber", "ola", "taxi", "cab", "flight", "train", "travel", "fuel"]):
            merchant = "Uber India" if "uber" in name_clean else "Airport Cabs"
            category = "TRAVEL"
            amount = 450.00 if "uber" in name_clean else 2200.00
            description = "Travel commute"
            
        elif any(k in name_clean for k in ["hotel", "airbnb", "stay", "room", "hostel"]):
            merchant = "Vilas Resort & Homestay"
            category = "STAY"
            amount = 4500.00
            description = "Weekend group accommodation"
            
        elif any(k in name_clean for k in ["netflix", "spotify", "movie", "cinema", "show"]):
            merchant = "Netflix Entertainment"
            category = "ENTERTAINMENT"
            amount = 649.00
            description = "Monthly family subscription"
            
        elif any(k in name_clean for k in ["electric", "water", "bill", "internet", "wifi"]):
            merchant = "State Electricity Board" if "electric" in name_clean else "Highspeed Telecom"
            category = "UTILITIES"
            amount = 1850.00 if "electric" in name_clean else 999.00
            description = "Monthly utilities payment"

        # Try to extract numbers from the file name if there is something like "120" or "45.50"
        amount_matches = re.findall(r'(\d+(?:\.\d{2})?)', file_name)
        if amount_matches:
            for match in amount_matches:
                val = float(match)
                if 10.0 <= val <= 50000.0:
                    amount = val
                    break

        # Generate a small list of items representing receipt line items
        items = [
            {"name": "Item 1", "amount": round(amount * 0.6, 2)},
            {"name": "Item 2", "amount": round(amount * 0.4, 2)}
        ]

        return {
            "merchant": merchant,
            "category": category,
            "amount": round(amount, 2),
            "description": description,
            "date": date,
            "items": items,
            "confidence_score": 0.92,
            "extracted_text_snippet": f"INVOICE\n{merchant.upper()}\nDATE: {date}\nTOTAL: INR {amount:.2f}\nTHANKS FOR YOUR PATRONAGE!"
        }
