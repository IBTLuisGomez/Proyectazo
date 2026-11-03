package com.proyectazo.security;

import com.proyectazo.model.AppUser;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

/** Usuario autenticado de la petición en curso. Los servicios lo usan para filtrar los datos por dueño. */
public final class CurrentUser {

    private CurrentUser() {}

    public static Long id() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AppUser user) {
            return user.getId();
        }
        throw new IllegalStateException("No hay un usuario autenticado en esta petición");
    }
}
