// src/components/dashboard/LoginForm.tsx
'use client';

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner"; // Usando o novo 'sonner'
import { loginAction } from "@/app/actions"; // Nossa lógica de servidor

// Esquema de validação do formulário com Zod
const formSchema = z.object({
  password: z.string().min(1, { message: "Senha é obrigatória." }),
});

// Definindo as propriedades que o componente espera receber
interface LoginFormProps {
  onLoginSuccess: () => void;
}

export function LoginForm({ onLoginSuccess }: LoginFormProps) {
  // Configuração do formulário com react-hook-form
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { password: "" },
  });

  // Função que é chamada quando o formulário é enviado
  async function onSubmit(values: z.infer<typeof formSchema>) {
    // Chama a nossa Server Action para verificar a senha no backend
    const success = await loginAction(values.password);

    if (success) {
      // Se a senha estiver correta, mostra uma notificação de sucesso e chama a função para mudar a tela
      toast.success("Login bem-sucedido!", {
        description: "Bem-vindo ao dashboard.",
      });
      onLoginSuccess();
    } else {
      // Se a senha estiver errada, mostra uma notificação de erro
      toast.error("Erro no Login", {
        description: "Senha incorreta. Tente novamente.",
      });
    }
  }

  // A parte visual do componente (o que aparece na tela)
  return (
    <main className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Acesso ao Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Senha</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full">Entrar</Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </main>
  );
}