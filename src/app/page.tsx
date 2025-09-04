// src/app/page.tsx
'use client';

import { useState } from 'react';
import { LoginForm } from '@/components/dashboard/LoginForm';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Toaster } from "@/components/ui/sonner"; // <--- MUDANÇA AQUI

export default function HomePage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // O <Toaster /> agora fica no layout principal e serve para a aplicação inteira.
  // Não precisamos mais renderizá-lo duas vezes.
  if (!isLoggedIn) {
    return (
      <>
        <LoginForm onLoginSuccess={() => setIsLoggedIn(true)} />
        <Toaster /> 
      </>
    );
  }

  return (
    <>
      <DashboardLayout />
      <Toaster />
    </>
  );
}