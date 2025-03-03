# BookVerse Frontend

## Overview
BookVerse is an online book reader platform with automated audio reading capabilities, allowing users to read and listen to books conveniently. This repository contains the frontend implementation, built with Next.js, a React framework for building server-side rendered and static web applications. The frontend interacts with the BookVerse backend via APIs to provide a seamless user experience.

## Features
- User authentication (login, signup, logout).
- Book browsing and reading interface.
- Automated audio playback for books.
- Responsive design for desktop and mobile devices.
- Real-time updates and error handling with client-side state management.

## Technologies
- **Next.js**: 15+
- **React**: 18+
- **TypeScript**: For type safety
- **Material-UI (MUI)**: For UI components and styling
- **Tailwind CSS**: For utility-first styling
- **axios** or **fetch**: For API requests to the backend
- **react-apexcharts**: For data visualization (optional, if used)

## Prerequisites
- Node.js: 18+ or higher
- npm or Yarn
- Access to the BookVerse backend API (running at `http://localhost:8000` or your production URL)

## Setup Instructions

### 1. Clone the Repository
```bash
git clone https://github.com/Ecode2/project.git
cd project
```

### 2. Install Dependencies
```bash
npm install
# Or with Yarn
yarn install
```

### 3. Configure Environment Variables
Create a `.env.local` file in the root directory with the following variables:
```
NEXT_PUBLIC_API_URL=http://localhost:8000/api/  # Backend API base URL
NEXT_PUBLIC_APP_URL=http://localhost:3000  # Frontend base URL
```

### 4. Run the Development Server
```bash
npm run dev
# Or with Yarn
yarn dev
```

The frontend will be available at `http://localhost:3000`.

### 5. Build for Production
```bash
npm run build
# Or with Yarn
yarn build
```
Then run the production server:
```bash
npm start
# Or with Yarn
yarn start
```

## Folder Structure
- `app/`: Next.js App Router pages and layouts.
- `components/`: Reusable UI components (e.g., book cards, audio players).
- `public/`: Static assets (images, favicon).
- `styles/`: Global CSS or Tailwind configurations.

## Contributing
1. Fork the repository.
2. Create a branch for your feature or bug fix:
   ```bash
   git checkout -b feature/your-feature
   ```
3. Commit your changes:
   ```bash
   git commit -m "Add your feature description"
   ```
4. Push to the branch:
   ```bash
   git push origin feature/your-feature
   ```
5. Submit a pull request.

## License
This project is licensed under the MIT License - see the `LICENSE` file for details.

## Contact
For questions or support, contact us at [ecode5814@gmail.com](mailto:ecode5814@gmail.com).
