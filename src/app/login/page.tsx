const validarAcceso = async (pinIngresado: string) => {
    setCargando(true)
    setMensaje('Validando credenciales...')

    try {
      const { data, error } = await supabase
        .from('accesos_pin')
        .select('*')
        .eq('pin', pinIngresado)
        .maybeSingle()

      if (error || !data) {
        setError(true)
        setPin('')
        setMensaje('❌ PIN INCORRECTO')
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([100, 100, 100])
        setTimeout(() => setMensaje('Ingresa tu PIN de acceso'), 2000)
      } else {
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([200, 100, 200])
        setMensaje(`✅ Bienvenido, ${data.propietario}`)
        
        // --- GUARDAMOS LA LLAVE SECRETA (SESSION COOKIE) ---
        // Al quitar max-age, la cookie muere cuando se cierra el navegador.
        document.cookie = `session_rol=${data.rol}; path=/; SameSite=Strict`;
        document.cookie = `session_user=${data.propietario}; path=/; SameSite=Strict`;
        
        setTimeout(() => {
          if (data.rol === 'admin') {
            window.location.href = '/dashboard'
          } else {
            window.location.href = '/escaner'
          }
        }, 1000)
      }
    } catch (err) {
      setError(true)
      setPin('')
      setMensaje('Error de red')
    } finally {
      setCargando(false)
    }
  }