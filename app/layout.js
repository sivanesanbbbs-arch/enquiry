import "./globals.css";

export const metadata = {
  title: "Executive Programme Enquiry | IIM Tiruchirappalli",
  description: "Enquiry form for prospective applicants interested in executive education programmes.",
};
export const viewport = { themeColor: "#7b1e2b", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
