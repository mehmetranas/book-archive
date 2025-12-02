import React, { useState } from 'react';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';

export const AuthNavigator = () => {
    const [isLogin, setIsLogin] = useState(true);

    return isLogin ? (
        <LoginScreen onNavigateToRegister={() => setIsLogin(false)} />
    ) : (
        <RegisterScreen onNavigateToLogin={() => setIsLogin(true)} />
    );
};
